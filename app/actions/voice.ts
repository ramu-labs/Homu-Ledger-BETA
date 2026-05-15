"use server";

// Server actions for the AI Voice Transactions surface (v1.41.0).
//
// Two entry points:
//   • transcribeVoiceAudio(blob)  → text via Groq Whisper-large-v3
//   • parseVoiceUtterance(text, context) → VoiceAction via Gemini
//
// The split mirrors the PRD: Whisper handles STT, Gemini handles NLU.
// Both keys live in app_settings (groq_api_key, gemini_api_key) so the
// rotation pattern is identical to the v1.25 categorize flow.
//
// The client-side voice shell calls these in sequence per utterance:
// record-until-silence → transcribe → parse → dispatch to reducer.
// No streaming; one round-trip per phrase. See PRD §7.1 for why we
// dropped SSE in favour of per-utterance batch (silence detection is
// reliable enough that real-time partials weren't earning their
// complexity).

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/llm/groq";
import { GEMINI_DEFAULT_MODEL, GEMINI_PROVIDER } from "@/lib/llm/gemini";
import { estimateCostUsd } from "@/lib/llm/pricing";
import { canonicalKey, candidateKeys } from "@/lib/llm/normalize";
import type { VoiceAction, VoiceContext } from "@/lib/voice/types";

// ── Auth + flag check ────────────────────────────────────────────────

// v1.42.0: cache the dev-check + flag-read for the lifetime of one
// server request. Each utterance fires both transcribeVoiceAudio AND
// parseVoiceUtterance — without this, that's 4 extra Supabase reads
// per phrase. With React.cache(), the second action call in the SAME
// request reuses the first call's resolved Promise. Free latency win.
//
// Note: server actions are SEPARATE requests, so this cache only helps
// when one action internally calls another (not our pattern today).
// We keep it anyway because the cache invariant is correct and the
// pattern composes well if future actions chain calls.
const getVoiceAccess = cache(async (): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; householdId: string | null }
  | { ok: false; error: string }
> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // One round-trip for both profile fields (developer + household).
  // Used by recordCategoryUsage downstream; saves a separate read.
  const [{ data: profileRow }, { data: flagRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_developer, household_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "voice_input_enabled")
      .maybeSingle(),
  ]);
  if (!profileRow?.is_developer) {
    return { ok: false, error: "Voice transactions are limited to developers right now." };
  }
  if (flagRow?.value !== "true") {
    return { ok: false, error: "Voice transactions are disabled for this environment." };
  }
  return { ok: true, supabase, householdId: profileRow.household_id ?? null };
});

async function requireVoiceAccess(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; householdId: string | null }
  | { ok: false; error: string }
> {
  return getVoiceAccess();
}

// ── Transcribe ───────────────────────────────────────────────────────

export async function transcribeVoiceAudio(formData: FormData): Promise<
  | { ok: true; text: string; durationSec: number | null; language: string | null }
  | { ok: false; error: string; unconfigured?: boolean }
> {
  const access = await requireVoiceAccess();
  if (!access.ok) return { ok: false, error: access.error };

  const raw = formData.get("audio");
  // FormDataEntryValue is `string | File`, but in our edge-runtime
  // server actions File is exposed via undici. Duck-type on .size
  // rather than instanceof — TS in Node20 doesn't narrow File reliably
  // on FormDataEntryValue.
  if (!raw || typeof raw === "string") {
    return { ok: false, error: "No audio attached" };
  }
  const file = raw as Blob;
  if (file.size > 25 * 1024 * 1024) {
    return { ok: false, error: "Audio too large (max 25 MB)." };
  }
  if (file.size < 800) {
    // < ~0.5s of audio — almost certainly an empty start/stop click.
    // Return empty text rather than spending a Whisper call.
    return { ok: true, text: "", durationSec: 0, language: null };
  }

  // Pass household ai_language as a hint when available; otherwise let
  // Whisper auto-detect (it switches between Bahasa + English mid-blob
  // pretty well on its own).
  const langHint = (formData.get("language_hint") as string | null) ?? null;

  const fileName =
    typeof (raw as { name?: unknown }).name === "string"
      ? ((raw as { name: string }).name)
      : "utterance.webm";

  const result = await transcribeAudio({
    audio: file,
    filename: fileName,
    language: langHint && langHint !== "auto" ? langHint : null,
    // Domain vocabulary nudge — small list of Indonesian terms the model
    // occasionally mishears. Keep this short; long prompts cost tokens.
    prompt: "Bensin, listrik, kopi, gajian, pampers, transfer, BCA, Mandiri",
  });

  if (!result.ok) return { ok: false, error: result.error, unconfigured: result.unconfigured };
  return {
    ok: true,
    text: result.text,
    durationSec: result.durationSec,
    language: result.language,
  };
}

// ── Parse one transcript → VoiceAction ────────────────────────────────

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Voice JSON parses are bigger than categorize answers — we may return
// an entire {kind, tx:{name, amount, ...}} object. 256 is a safe ceiling.
const VOICE_MAX_OUTPUT_TOKENS = 256;

export async function parseVoiceUtterance(
  transcript: string,
  context: VoiceContext
): Promise<
  | { ok: true; action: VoiceAction; tokensIn: number; tokensOut: number }
  | { ok: false; error: string; unconfigured?: boolean }
> {
  const access = await requireVoiceAccess();
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = access.supabase;

  const cleaned = transcript.trim();
  if (!cleaned) return { ok: true, action: { kind: "noop" }, tokensIn: 0, tokensOut: 0 };

  // Read the Gemini key (mirrors lib/llm/gemini.ts)
  const { data: keyRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .maybeSingle();
  const rawKey = keyRow?.value?.trim();
  if (!rawKey) {
    return {
      ok: false,
      error: "Voice parsing requires a Gemini API key. Configure it in Settings → AI admin.",
      unconfigured: true,
    };
  }
  // Bind to a non-optional const so the closure below preserves the
  // narrowing across the nested async-function declaration. (TS gives
  // up narrowing on `apiKey?.trim()` when re-read inside the closure.)
  const apiKey: string = rawKey;

  // Build the parse prompt. We embed the household categories + wallets
  // verbatim so Gemini can pick by name. The "Output JSON only" line is
  // critical — without it Flash-Lite tends to wrap the answer in
  // ```json fences or chat-style "Here's the action:" preambles.
  const catList = context.categories
    .map((c) => `- ${c.id} | ${c.name} | ${c.type}`)
    .join("\n");
  const walletList = context.wallets
    .map((w) => `- ${w.id} | ${w.name}`)
    .join("\n");
  const rowList = context.rows.length
    ? context.rows.map((r) => `- ${r.id} | ${r.name}`).join("\n")
    : "(none yet)";

  const prompt =
    `You are a transaction parser for a household ledger. The user spoke ` +
    `ONE short utterance in Indonesian or English. Return ONE JSON action.\n\n` +
    `Available categories (id | name | type):\n${catList}\n\n` +
    `Available wallets (id | name):\n${walletList}\n\n` +
    `Current draft rows (id | name):\n${rowList}\n\n` +
    `Action shapes (output exactly one):\n` +
    `  {"kind":"add","tx":{"name":string,"amount":number,"type":"expense"|"income","category_id":string|null,"wallet_id":string|null}}\n` +
    `  {"kind":"update","target":{"name":string|null,"mostRecent":boolean},"patch":{"amount":number?,"category_id":string?,"wallet_id":string?,"name":string?}}\n` +
    `  {"kind":"remove","target":{"name":string|null,"mostRecent":boolean}}\n` +
    `  {"kind":"transfer","tx":{"name":string,"amount":number,"from_wallet_id":string,"to_wallet_id":string}}\n` +
    `  {"kind":"noop"}\n\n` +
    `Rules:\n` +
    `- Indonesian number words: "tiga ratus ribu" = 300000, "satu juta dua ratus" = 1200000, "sepuluh ribu lima ratus" = 10500, "lima belas juta" = 15000000.\n` +
    `- target.name = case-insensitive substring on a draft row name. mostRecent:true means the row most recently added.\n` +
    `- category_id and wallet_id MUST be one of the ids listed above, or null. Never invent ids.\n` +
    `- If the utterance is off-topic (small talk, filler) return {"kind":"noop"}.\n` +
    `- For transfers, identify both from and to wallets from the list.\n` +
    `- Income vs expense: words like "gajian", "salary", "bonus", "refund", "income" → income. Everything else default to expense.\n` +
    `- Default to no wallet_id (null) unless the user named one.\n\n` +
    `Utterance: "${cleaned.slice(0, 400)}"\n\n` +
    `Output JSON only. No commentary, no code fences.`;

  // v1.42.0: retry-once on transient Gemini errors (5xx / 429) and
  // network failures. Same pattern as Groq retry — 250ms backoff,
  // one attempt only, no retry on 4xx auth errors.
  async function callGemini(): Promise<Response | { networkErr: Error }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      return await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(GEMINI_DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.0,
              responseMimeType: "application/json",
              maxOutputTokens: VOICE_MAX_OUTPUT_TOKENS,
            },
          }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      return { networkErr: err as Error };
    } finally {
      clearTimeout(timeout);
    }
  }

  let res: Response;
  const first = await callGemini();
  if ("networkErr" in first) {
    await new Promise((r) => setTimeout(r, 250));
    const second = await callGemini();
    if ("networkErr" in second) {
      return { ok: false, error: `Gemini call failed: ${second.networkErr.message}` };
    }
    res = second;
  } else if (first.status === 429 || first.status >= 500) {
    await new Promise((r) => setTimeout(r, 250));
    const second = await callGemini();
    if ("networkErr" in second) {
      return { ok: false, error: `Gemini call failed: ${second.networkErr.message}` };
    }
    res = second;
  } else {
    res = first;
  }

  if (!res.ok) {
    return { ok: false, error: `Gemini ${res.status}` };
  }

  type GeminiResp = {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  const json = (await res.json()) as GeminiResp;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const tokensIn = json.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = json.usageMetadata?.candidatesTokenCount ?? 0;

  // Best-effort usage log — same pattern as categorize().
  try {
    await supabase.rpc("log_api_usage", {
      p_provider: GEMINI_PROVIDER,
      p_model: GEMINI_DEFAULT_MODEL,
      p_input_tokens: tokensIn,
      p_output_tokens: tokensOut,
      p_estimated_cost: estimateCostUsd(GEMINI_DEFAULT_MODEL, tokensIn, tokensOut),
      p_feature: "voice_parse",
      p_cache_status: "miss",
      p_preview: cleaned.slice(0, 80),
    });
  } catch {
    /* swallow logging failures */
  }

  if (!text) {
    return { ok: true, action: { kind: "noop" }, tokensIn, tokensOut };
  }

  const action = safeParseAction(text, context);

  // v1.42.0: cross-feature integration with the category_hints cache
  // (originally built for the typed Add Transaction sheet in v1.25.0).
  //
  // If the user has previously trained the cache for this description
  // — by saving a typed transaction with a manually-chosen category —
  // that's a STRONGER signal than Gemini's guess. We override.
  //
  // This makes the two AI surfaces share a single source of truth: the
  // user trains once, voice + typing both benefit. And it's free —
  // category_hints is a single indexed Postgres lookup.
  const enriched = await applyCachedCategory(action, access.householdId);
  return { ok: true, action: enriched, tokensIn, tokensOut };
}

/**
 * If the parsed action carries a description (add or update with a
 * name patch), look it up in category_hints. On hit, override the
 * action's category_id with the cached one — user-confirmed mappings
 * trump model guesses.
 */
async function applyCachedCategory(
  action: VoiceAction,
  householdId: string | null
): Promise<VoiceAction> {
  if (!householdId) return action;
  // Only meaningful for the "add" path. For "update" we'd need to
  // know the row's name BEFORE this server call, which we don't have
  // (the target resolves client-side). Voice updates that change
  // category by voice already pass category_id explicitly.
  if (action.kind !== "add") return action;
  const name = action.tx.name;
  if (!name) return action;

  const candidates = candidateKeys(name);
  if (candidates.length === 0) return action;

  // Single indexed query against the cache. The .in() with the small
  // candidate list (typically 3–6 entries) is ~1ms on a warm DB.
  const supabase = await createClient();
  const { data: hints } = await supabase
    .from("category_hints")
    .select("keyword, category_id")
    .eq("household_id", householdId)
    .in("keyword", candidates);
  if (!hints || hints.length === 0) return action;

  // Iterate candidates in order (longest/most-specific first) so a
  // trained "kopi di kaldi" hint beats a generic "kopi" hint when both
  // exist.
  const byKey = new Map(hints.map((h) => [h.keyword, h.category_id]));
  for (const key of candidates) {
    const cid = byKey.get(key);
    if (cid && cid !== action.tx.category_id) {
      return { ...action, tx: { ...action.tx, category_id: cid } };
    }
  }
  return action;
}

/** Public so the client-side save can mirror voice picks into the
 *  shared cache. Mirrors recordCategoryUsage from app/actions/ai.ts
 *  but reuses the voice access check we already paid for. */
export async function recordVoiceCategoryUsage(
  description: string,
  categoryId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireVoiceAccess();
  if (!access.ok) return { ok: false, error: access.error };
  if (!access.householdId) return { ok: false, error: "No household" };

  const key = canonicalKey(description);
  if (!key) return { ok: false, error: "Empty description" };

  // Verify the category belongs to this household — same guard as
  // recordCategoryUsage. Cheap and avoids cross-household poisoning.
  const { data: cat } = await access.supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("household_id", access.householdId)
    .maybeSingle();
  if (!cat) return { ok: false, error: "Category not in household" };

  await access.supabase.from("category_hints").upsert(
    {
      household_id: access.householdId,
      keyword: key,
      category_id: categoryId,
      // 'user' source — voice picks where the user said the category
      // out loud are effectively user-confirmed. Treating them as 'ai'
      // would let a future cleanup job evict them more easily than the
      // user expects.
      source: "user",
    },
    { onConflict: "household_id,keyword" }
  );
  return { ok: true };
}

// ── JSON parsing + validation ────────────────────────────────────────
//
// Gemini sometimes wraps in ```json fences despite our instructions
// (especially on first cold call). Strip them, then JSON.parse, then
// validate the shape against our discriminated union. Anything off →
// treat as noop (the user can re-say it).

function safeParseAction(raw: string, ctx: VoiceContext): VoiceAction {
  let stripped = raw.trim();
  // Strip code fences if present
  if (stripped.startsWith("```")) {
    stripped = stripped
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { kind: "noop" };
  }
  if (!parsed || typeof parsed !== "object") return { kind: "noop" };

  const obj = parsed as Record<string, unknown>;
  const kind = obj.kind;

  // Sets for fast id-existence checks
  const catIds = new Set(ctx.categories.map((c) => c.id));
  const walletIds = new Set(ctx.wallets.map((w) => w.id));

  if (kind === "noop") return { kind: "noop" };

  if (kind === "add") {
    const tx = obj.tx as Record<string, unknown> | undefined;
    if (!tx) return { kind: "noop" };
    const name = typeof tx.name === "string" ? tx.name.trim() : "";
    const amount = typeof tx.amount === "number" ? Math.round(tx.amount) : NaN;
    const type = tx.type === "income" ? "income" : "expense";
    if (!name || !Number.isFinite(amount) || amount <= 0) return { kind: "noop" };
    const category_id =
      typeof tx.category_id === "string" && catIds.has(tx.category_id) ? tx.category_id : null;
    const wallet_id =
      typeof tx.wallet_id === "string" && walletIds.has(tx.wallet_id) ? tx.wallet_id : null;
    return { kind: "add", tx: { name, amount, type, category_id, wallet_id } };
  }

  if (kind === "transfer") {
    const tx = obj.tx as Record<string, unknown> | undefined;
    if (!tx) return { kind: "noop" };
    const name = (typeof tx.name === "string" ? tx.name.trim() : "") || "Transfer";
    const amount = typeof tx.amount === "number" ? Math.round(tx.amount) : NaN;
    const from = typeof tx.from_wallet_id === "string" ? tx.from_wallet_id : "";
    const to = typeof tx.to_wallet_id === "string" ? tx.to_wallet_id : "";
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !walletIds.has(from) ||
      !walletIds.has(to) ||
      from === to
    ) {
      return { kind: "noop" };
    }
    return {
      kind: "transfer",
      tx: { name, amount, from_wallet_id: from, to_wallet_id: to },
    };
  }

  if (kind === "update") {
    const target = obj.target as Record<string, unknown> | undefined;
    const patch = obj.patch as Record<string, unknown> | undefined;
    if (!target || !patch) return { kind: "noop" };
    const cleanPatch: {
      amount?: number;
      category_id?: string | null;
      wallet_id?: string | null;
      name?: string;
    } = {};
    if (typeof patch.amount === "number" && patch.amount > 0) cleanPatch.amount = Math.round(patch.amount);
    if (typeof patch.category_id === "string" && catIds.has(patch.category_id)) cleanPatch.category_id = patch.category_id;
    if (typeof patch.wallet_id === "string" && walletIds.has(patch.wallet_id)) cleanPatch.wallet_id = patch.wallet_id;
    if (typeof patch.name === "string" && patch.name.trim()) cleanPatch.name = patch.name.trim();
    if (Object.keys(cleanPatch).length === 0) return { kind: "noop" };
    return {
      kind: "update",
      target: {
        name: typeof target.name === "string" ? target.name : null,
        mostRecent: target.mostRecent === true,
      },
      patch: cleanPatch,
    };
  }

  if (kind === "remove") {
    const target = obj.target as Record<string, unknown> | undefined;
    if (!target) return { kind: "noop" };
    return {
      kind: "remove",
      target: {
        name: typeof target.name === "string" ? target.name : null,
        mostRecent: target.mostRecent === true,
      },
    };
  }

  return { kind: "noop" };
}
