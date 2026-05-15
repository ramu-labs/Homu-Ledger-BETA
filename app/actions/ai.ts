"use server";

// AI-categorization server actions.
//
// suggestCategory(description, type)
//   ─ Normalise the description → candidate keys.
//   ─ Look each key up in category_hints (longest-first wins).
//   ─ On hit: return the cached category_id, log a "hit" row.
//   ─ On miss: call Gemini, match its answer back to a real
//     category for the user's household, insert a hint, return.
//   ─ On any error or unconfigured key: return no suggestion. Never
//     blocks the user — they can still pick a category manually.
//
// recordCategoryUsage(description, categoryId)
//   ─ Called when the user saves a transaction. Upserts the hint with
//     the (possibly corrected) categoryId so the cache learns from
//     the user's actual choice — passive correction learning, but
//     cheap (no AI call).
//
// saveGeminiKey / testGeminiConnection
//   ─ Developer-only. Wired to the /settings/ai-admin dev panel.
//
// All four guarded by auth.uid() + household membership; the RPCs we
// call are SECURITY DEFINER and do their own developer/auth checks.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categorize, logCacheHit, testConnection, GEMINI_DEFAULT_MODEL } from "@/lib/llm/gemini";
import { candidateKeys, canonicalKey } from "@/lib/llm/normalize";

const FEATURE_CATEGORIZE = "auto_categorize";

export type SuggestCategoryResult =
  | {
      ok: true;
      categoryId: string;
      categoryName: string;
      source: "cache" | "ai";
    }
  | { ok: false; reason: "no_match" | "no_categories" | "no_session" | "ai_error" | "ai_unconfigured" };

/**
 * Return a category suggestion for a transaction description.
 *
 * Cache-first: most calls resolve in a single indexed Postgres lookup.
 * Only true misses ever hit Gemini, and those misses warm the cache so
 * the next identical description is free.
 */
export async function suggestCategory(
  description: string,
  type: "income" | "expense"
): Promise<SuggestCategoryResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no_session" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.household_id) return { ok: false, reason: "no_session" };

  const candidates = candidateKeys(description);
  if (candidates.length === 0) return { ok: false, reason: "no_match" };

  // Pull the household's categories + ai_language in two parallel
  // queries. We need ai_language to bias the Gemini prompt correctly
  // on cache miss; cache hits don't use it but we pay one cheap round
  // trip either way.
  const [{ data: categories }, { data: householdRow }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type")
      .eq("household_id", profile.household_id),
    supabase
      .from("households")
      .select("ai_language")
      .eq("id", profile.household_id)
      .maybeSingle(),
  ]);

  if (!categories || categories.length === 0) {
    return { ok: false, reason: "no_categories" };
  }

  const allowedByType = categories.filter((c) => c.type === type);
  if (allowedByType.length === 0) return { ok: false, reason: "no_categories" };
  const allowedIds = new Set(allowedByType.map((c) => c.id));

  // ── Cache lookup ──────────────────────────────────────────────────
  // Fetch all matching hints in one query (saves a round-trip per
  // candidate). Then iterate candidates IN ORDER and pick the first
  // hint that points to a category of the right type.
  const { data: hints } = await supabase
    .from("category_hints")
    .select("keyword, category_id, hits, source")
    .eq("household_id", profile.household_id)
    .in("keyword", candidates);

  if (hints && hints.length > 0) {
    const hintByKey = new Map(hints.map((h) => [h.keyword, h]));
    for (const key of candidates) {
      const hit = hintByKey.get(key);
      if (hit && allowedIds.has(hit.category_id)) {
        const cat = allowedByType.find((c) => c.id === hit.category_id);
        if (cat) {
          // Fire-and-forget cache-hit log; don't block the response.
          void logCacheHit({
            feature: FEATURE_CATEGORIZE,
            preview: description.slice(0, 80),
          });
          return {
            ok: true,
            categoryId: cat.id,
            categoryName: cat.name,
            source: "cache",
          };
        }
      }
    }
  }

  // ── Cache miss → Gemini ───────────────────────────────────────────
  const aiLanguage = (householdRow?.ai_language ?? "auto") as "auto" | "en" | "id";
  const result = await categorize({
    description,
    categoryNames: allowedByType.map((c) => c.name),
    feature: FEATURE_CATEGORIZE,
    language: aiLanguage,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.unconfigured ? "ai_unconfigured" : "ai_error",
    };
  }

  // Match the model's text answer back to one of our category names.
  // Case-insensitive exact match — Gemini's been told to reply with
  // the name verbatim, but case can drift on edge cases.
  const wanted = result.category.trim().toLowerCase();
  const matched = allowedByType.find((c) => c.name.toLowerCase() === wanted);
  if (!matched) {
    return { ok: false, reason: "no_match" };
  }

  // Warm the cache so this description is a hit next time. Use the
  // canonical key (cleaned full description minus trailing unit) so
  // re-typing the exact phrase is instant; the candidateKeys logic on
  // future lookups will still find this via prefix-match for
  // close-but-not-identical phrasings.
  const key = canonicalKey(description);
  if (key) {
    await supabase.from("category_hints").upsert(
      {
        household_id: profile.household_id,
        keyword: key,
        category_id: matched.id,
        source: "ai",
      },
      { onConflict: "household_id,keyword" }
    );
  }

  return {
    ok: true,
    categoryId: matched.id,
    categoryName: matched.name,
    source: "ai",
  };
}

/**
 * Tell the cache about the user's actual chosen category. Called from
 * the save handler on Add Transaction. Idempotent — upserts source =
 * 'user' so we can tell user-confirmed mappings apart from AI guesses
 * later (handy if we ever want to weight one more than the other).
 *
 * No-op when description / category is missing, so callers don't have
 * to guard.
 */
export async function recordCategoryUsage(
  description: string,
  categoryId: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!categoryId) return { ok: false, reason: "no_category" };

  const key = canonicalKey(description);
  if (!key) return { ok: false, reason: "no_description" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no_session" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.household_id) return { ok: false, reason: "no_household" };

  // Verify the category belongs to this household — guards against a
  // stale category_id sneaking in from another household, which would
  // otherwise create a cache row pointing across households.
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("household_id", profile.household_id)
    .maybeSingle();
  if (!cat) return { ok: false, reason: "category_not_in_household" };

  await supabase.from("category_hints").upsert(
    {
      household_id: profile.household_id,
      keyword: key,
      category_id: categoryId,
      source: "user",
      // Don't bump `hits` here — that's incremented by the RPC if/when
      // we add a hit counter to the cache lookup. Bumping it on every
      // save would conflate "cache hits" with "user usage", which are
      // different metrics in the dev panel.
    },
    { onConflict: "household_id,keyword" }
  );

  return { ok: true };
}

// ─── Developer-only ──────────────────────────────────────────────────

export async function saveGeminiKey(
  rawKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const trimmed = (rawKey ?? "").trim();
  if (!trimmed) return { ok: false, error: "Key is required" };
  if (trimmed.length < 20) return { ok: false, error: "Key looks too short — paste the full one." };

  // The RPC enforces the developer check + auth; we only get a
  // user-visible error here if RLS / the function rejects us.
  const { error } = await supabase.rpc("save_app_setting", {
    p_key: "gemini_api_key",
    p_value: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/ai-admin");
  return { ok: true };
}

export async function clearGeminiKey(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // Same developer gate as save — we set the value to "" so RLS allows
  // the update (a delete would require its own policy and we don't
  // want to grant DELETE on app_settings).
  const { error } = await supabase.rpc("save_app_setting", {
    p_key: "gemini_api_key",
    p_value: "",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/ai-admin");
  return { ok: true };
}

// ─── Voice (v1.41.0) ─────────────────────────────────────────────────
//
// Whisper key + feature-flag toggle. Stored alongside the Gemini key
// in app_settings so the same `save_app_setting` SECURITY DEFINER RPC
// handles auth + developer-check.

export async function saveGroqKey(
  rawKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const trimmed = (rawKey ?? "").trim();
  if (!trimmed) return { ok: false, error: "Key is required" };
  if (trimmed.length < 20) return { ok: false, error: "Key looks too short — paste the full one." };

  const { error } = await supabase.rpc("save_app_setting", {
    p_key: "groq_api_key",
    p_value: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/ai-admin");
  revalidatePath("/settings/ai-admin/voice");
  return { ok: true };
}

export async function clearGroqKey(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_app_setting", {
    p_key: "groq_api_key",
    p_value: "",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/ai-admin");
  revalidatePath("/settings/ai-admin/voice");
  return { ok: true };
}

/** Flip the voice-feature kill-switch. Stored as the string "true"
 *  or "" so empty/missing = off. */
export async function setVoiceInputEnabled(
  enabled: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_app_setting", {
    p_key: "voice_input_enabled",
    p_value: enabled ? "true" : "",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/ai-admin");
  revalidatePath("/settings/ai-admin/voice");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function testGeminiConnection(): Promise<{
  ok: true;
  category: string;
  tokens: number;
  model: string;
}
| { ok: false; error: string; unconfigured?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_developer")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_developer) return { ok: false, error: "Developer access required." };

  const result = await testConnection();
  if (!result.ok) {
    return { ok: false, error: result.error, unconfigured: result.unconfigured };
  }
  return {
    ok: true,
    category: result.category,
    tokens: result.inputTokens + result.outputTokens,
    model: result.model || GEMINI_DEFAULT_MODEL,
  };
}
