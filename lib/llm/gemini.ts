// Server-only Gemini Flash-Lite REST wrapper.
//
// All LLM calls in the app funnel through this module — that way the
// API key never touches client code (it's read from app_settings via
// a SECURITY DEFINER RPC on the server) and every call gets logged to
// api_usage_logs with consistent fields.
//
// The categorize() function is the only consumer-facing entry today;
// add more if we expand AI features (transaction summarisation, etc).
//
// IMPORTANT: do not import this file from a Client Component. It calls
// the Supabase server client and reads server-only env. Importing it
// client-side will work in dev but leak the auth surface in prod.

import { createClient } from "@/lib/supabase/server";
import { estimateCostUsd } from "@/lib/llm/pricing";

export const GEMINI_PROVIDER = "gemini";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Hard ceiling on output tokens — categorisation responses are a
// single category name, never more than a few tokens. Capping this
// keeps a misbehaving model from blowing through the token budget on
// a freeform answer.
const MAX_OUTPUT_TOKENS = 30;

export type CategorizeOk = {
  ok: true;
  category: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};
export type CategorizeErr = {
  ok: false;
  error: string;
  // Set when the failure is "you forgot to configure a key" — the UI
  // surfaces this differently from a transient network/quota error.
  unconfigured?: boolean;
};
export type CategorizeResult = CategorizeOk | CategorizeErr;

/**
 * Ask Gemini to pick one category from the provided list for a given
 * transaction description. Returns the model's raw answer + token
 * counts so the caller can log usage. The caller is responsible for
 * matching the returned string back to an actual category_id.
 *
 * `feature` ends up in api_usage_logs so we can split tokens by feature
 * in the dev panel later (e.g. categorize vs. summarise).
 */
export async function categorize(args: {
  description: string;
  categoryNames: string[];
  feature: string;
  // Household's AI-language preference (added v1.27.0). When set to
  // 'id' / 'en' the prompt explicitly tells the model the description
  // is in that language — otherwise Flash-Lite tends to interpret
  // Indonesian phrases as English ("Babi Cincang" → "Baby" instead of
  // "Pork"). 'auto' (default) leaves it to the model to guess.
  language?: "auto" | "en" | "id";
}): Promise<CategorizeResult> {
  const { description, categoryNames, feature, language = "auto" } = args;

  const supabase = await createClient();

  // 1) Pull the API key. Stored in app_settings under key "gemini_api_key".
  //    RLS gates SELECT to developers, so this read fails for non-devs;
  //    the categorize action above checks the user is authenticated
  //    before calling us, but we still return a clean error for the
  //    "key isn't set yet" case so the UI doesn't show a scary 401.
  const { data: keyRow, error: keyErr } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .maybeSingle();

  if (keyErr) {
    await logUsage(supabase, {
      model: GEMINI_DEFAULT_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      feature,
      cacheStatus: "error",
      preview: previewOf(description),
    });
    return { ok: false, error: "Couldn't read API key — check developer access." };
  }
  if (!keyRow?.value) {
    return { ok: false, error: "Gemini API key not configured.", unconfigured: true };
  }

  const model = await getModel(supabase);
  const apiKey = keyRow.value;

  // 2) Build the prompt. Keep it tiny — we're paying per token, and
  //    the model's answer is just a category name. The "Reply with
  //    ONLY the category name" line is critical: without it Flash-Lite
  //    occasionally wraps the answer in punctuation or explains itself.
  //
  //    Language hint: when the household has set `ai_language` to a
  //    specific language, we prepend a one-line instruction so the
  //    model interprets the description in that language. Fixes
  //    "Babi Cincang" being read as "Baby..." instead of pork.
  const languageHint =
    language === "id"
      ? "The description is in Bahasa Indonesia (Indonesian). Interpret it accordingly — do NOT translate Indonesian words as if they were English (e.g. 'babi' means pork, not baby).\n\n"
      : language === "en"
      ? "The description is in English.\n\n"
      : "";

  const prompt =
    `You are a transaction categorizer. Pick ONE category from the list ` +
    `that best fits the description.\n\n` +
    languageHint +
    `Categories:\n${categoryNames.map((n) => `- ${n}`).join("\n")}\n\n` +
    `Description: ${description.slice(0, 200)}\n\n` +
    `Reply with ONLY the category name, exactly as it appears in the list. ` +
    `If none fit well, reply with "Other".`;

  // 3) Call Gemini. AbortController + 6s timeout — categorisation is on
  //    the critical path of the user typing, so we'd rather give up
  //    and let them pick manually than block their UI for 30s.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  let res: Response;
  try {
    res = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        }),
        signal: controller.signal,
      }
    );
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : "Network error";
    await logUsage(supabase, {
      model,
      inputTokens: 0,
      outputTokens: 0,
      feature,
      cacheStatus: "error",
      preview: previewOf(description),
    });
    return { ok: false, error: `Gemini call failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // Log the call as an error so total error rate shows up in the
    // dev panel. We don't surface Gemini's verbose error body to the
    // UI — just the status — to avoid accidentally leaking the key in
    // a verbose JSON dump.
    const status = res.status;
    await logUsage(supabase, {
      model,
      inputTokens: 0,
      outputTokens: 0,
      feature,
      cacheStatus: "error",
      preview: previewOf(description),
    });
    return { ok: false, error: `Gemini returned ${status}.` };
  }

  // 4) Parse usage metadata + the answer text. Gemini's response shape
  //    is `{ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { ... } }`.
  type GeminiResp = {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const json = (await res.json()) as GeminiResp;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

  await logUsage(supabase, {
    model,
    inputTokens,
    outputTokens,
    feature,
    cacheStatus: "miss",
    preview: previewOf(description),
  });

  if (!text) {
    return { ok: false, error: "Gemini returned an empty answer." };
  }

  // Strip surrounding quotes / punctuation that Flash-Lite occasionally
  // wraps the category name in despite the "ONLY the category name"
  // instruction. Keeps the matching logic in app/actions/ai.ts simpler.
  const cleaned = text
    .replace(/^[`'"\s-]+/, "")
    .replace(/[`'"\s.!?]+$/, "")
    .trim();

  return {
    ok: true,
    category: cleaned,
    inputTokens,
    outputTokens,
    model,
  };
}

/** Tiny smoke-test for the dev panel's "Test connection" button. */
export async function testConnection(): Promise<CategorizeResult> {
  return categorize({
    description: "Coffee",
    categoryNames: ["Food & Drink", "Transport", "Other"],
    feature: "test_connection",
  });
}

/**
 * Log a row to api_usage_logs via the SECURITY DEFINER RPC. Best-effort
 * — if the log call fails we still return the categorisation result
 * (we don't want a logging hiccup to break the user's UX).
 */
async function logUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    feature: string;
    cacheStatus: "miss" | "hit" | "error";
    preview: string | null;
  }
) {
  const cost = estimateCostUsd(args.model, args.inputTokens, args.outputTokens);
  try {
    await supabase.rpc("log_api_usage", {
      p_provider: GEMINI_PROVIDER,
      p_model: args.model,
      p_input_tokens: args.inputTokens,
      p_output_tokens: args.outputTokens,
      p_estimated_cost: cost,
      p_feature: args.feature,
      p_cache_status: args.cacheStatus,
      // RPC generated type is `p_preview?: string` so null isn't
      // assignable; coerce to undefined to take the DEFAULT NULL path.
      p_preview: args.preview ?? undefined,
    });
  } catch {
    // Don't crash the categorisation flow over a logging failure.
  }
}

/**
 * Log a cache hit (no Gemini call). Public so app/actions/ai.ts can
 * record hits for the hit-rate stat without going through the
 * categorize() path.
 */
export async function logCacheHit(args: {
  feature: string;
  preview: string | null;
}): Promise<void> {
  const supabase = await createClient();
  await logUsage(supabase, {
    model: GEMINI_DEFAULT_MODEL,
    inputTokens: 0,
    outputTokens: 0,
    feature: args.feature,
    cacheStatus: "hit",
    preview: args.preview,
  });
}

/** Get the configured model, falling back to the default. Allows
 *  app_settings to override the model name without a code deploy. */
async function getModel(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_model")
    .maybeSingle();
  return data?.value || GEMINI_DEFAULT_MODEL;
}

/** Truncated preview for api_usage_logs.preview. Keeps the column
 *  small + avoids accidentally storing very long descriptions verbatim. */
function previewOf(s: string): string | null {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return null;
  return trimmed.length > 80 ? trimmed.slice(0, 77) + "..." : trimmed;
}
