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

import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/llm/groq";
import { GEMINI_DEFAULT_MODEL, GEMINI_PROVIDER } from "@/lib/llm/gemini";
import { estimateCostUsd } from "@/lib/llm/pricing";
import type { VoiceAction, VoiceContext } from "@/lib/voice/types";

// ── Auth + flag check ────────────────────────────────────────────────

async function requireVoiceAccess(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // voice_input_enabled is a soft kill-switch — flip it off in the AI
  // admin if a regression or cost spike shows up. Default off when the
  // row hasn't been created yet (so a fresh install doesn't accidentally
  // start charging Groq before the dev configures it).
  const { data: flagRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "voice_input_enabled")
    .maybeSingle();
  if (flagRow?.value !== "true") {
    return { ok: false, error: "Voice transactions are disabled for this environment." };
  }

  return { ok: true, supabase };
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
  const apiKey = keyRow?.value?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "Voice parsing requires a Gemini API key. Configure it in Settings → AI admin.",
      unconfigured: true,
    };
  }

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  let res: Response;
  try {
    res = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(GEMINI_DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.0,
            // Force JSON-only output — Gemini 1.5+/2.5 honours this and
            // it sidesteps the "wrapped in ```json fences" failure mode.
            responseMimeType: "application/json",
            maxOutputTokens: VOICE_MAX_OUTPUT_TOKENS,
          },
        }),
        signal: controller.signal,
      }
    );
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, error: `Gemini call failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
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
  return { ok: true, action, tokensIn, tokensOut };
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
