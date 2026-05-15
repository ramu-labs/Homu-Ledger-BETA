// Server-only Groq Whisper wrapper.
//
// Groq hosts Whisper-large-v3 on its own LPU hardware. Same model, same
// accuracy on Bahasa Indonesia + English code-switching, but ~10× faster
// than OpenAI's Whisper API and on a generous free tier (~28,800
// audio-seconds/day at the time of writing, v1.41.0 ship). API shape is
// OpenAI-compatible (`/openai/v1/audio/transcriptions`), so swapping
// providers later is a one-line change.
//
// We mirror the gemini.ts pattern: the key lives in app_settings,
// is fetched via a server-side SELECT, never reaches the client. The
// only public surface is `transcribeAudio({ blob, language? })`.
//
// IMPORTANT: do not import this from a Client Component. It reads the
// Supabase server client and the API key — both server-only.

import { createClient } from "@/lib/supabase/server";

export const GROQ_PROVIDER = "groq";
// v1.42.0: switched from whisper-large-v3 to the -turbo variant. Same
// underlying model, distilled for ~3× lower latency. Real-world Bahasa
// + English code-switching accuracy is within 1-2% of the non-turbo
// in our spot-checks — plenty for transaction names. The user-perceived
// 'speak → row appears' gap drops from ~1s to ~350ms.
export const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";
const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export type TranscribeOk = {
  ok: true;
  text: string;
  // Whisper returns a duration in seconds (helps us bill / cap calls).
  durationSec: number | null;
  language: string | null;
  model: string;
};
export type TranscribeErr = {
  ok: false;
  error: string;
  // Set when no key is configured — UI surfaces this differently from
  // a transient network/quota error.
  unconfigured?: boolean;
};
export type TranscribeResult = TranscribeOk | TranscribeErr;

/**
 * Transcribe a single utterance audio blob.
 *
 * The audio comes from the client's MediaRecorder, typically in
 * `audio/webm;codecs=opus` on Chrome/Android or `audio/mp4` on iOS
 * Safari. Whisper-large-v3 accepts both, plus wav/mp3/flac/ogg/m4a.
 *
 * Language hint: pass `id` or `en` if the household has a preferred
 * language; pass `null` (default) to let Whisper auto-detect. Voice
 * Transactions households are bilingual id/en, so auto-detect is the
 * usual call.
 */
export async function transcribeAudio(args: {
  audio: Blob | File;
  filename?: string;
  // Whisper supports ISO-639-1 language codes — "id", "en", "fr", …
  language?: string | null;
  // Hint that biases the model toward your domain vocabulary. Helpful
  // for category names ("Bensin", "Listrik") that Whisper occasionally
  // mishears.
  prompt?: string;
}): Promise<TranscribeResult> {
  const { audio, filename = "audio.webm", language = null, prompt } = args;

  const supabase = await createClient();

  const { data: keyRow, error: keyErr } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "groq_api_key")
    .maybeSingle();

  if (keyErr) {
    return { ok: false, error: "Couldn't reach AI settings", unconfigured: false };
  }
  const apiKey = keyRow?.value?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "Voice transcription isn't configured yet. A developer needs to add a Groq API key in Settings → AI admin → Voice.",
      unconfigured: true,
    };
  }

  // Whisper transcription endpoint takes multipart/form-data. We pass
  // the blob as a File so the boundary header is set correctly. Node 20+
  // has Blob/File/FormData natively in undici, so this works in App
  // Router server actions without any polyfill.
  const fd = new FormData();
  // File extends Blob; wrapping is only necessary when the caller
  // hands us a raw Blob (no filename). We duck-type rather than
  // `instanceof File` because TS doesn't reliably narrow that on the
  // FormDataEntryValue input chain in Node 20.
  const hasName = typeof (audio as { name?: unknown }).name === "string";
  const file = hasName
    ? (audio as File)
    : new File([audio], filename, { type: audio.type || "audio/webm" });
  fd.set("file", file);
  fd.set("model", GROQ_WHISPER_MODEL);
  // `verbose_json` returns text + segments + language + duration. We
  // only need text + duration + language but the segments are useful
  // for future word-level timestamping / silence detection on the
  // server side.
  fd.set("response_format", "verbose_json");
  fd.set("temperature", "0");
  if (language) fd.set("language", language);
  if (prompt) fd.set("prompt", prompt);

  // v1.42.0: single retry on transient 5xx / 429 / network error.
  // Groq's free tier occasionally throttles a few seconds at a time;
  // re-trying once after a 250ms backoff hides 90% of those without
  // turning a clean failure into an infinite loop. We DON'T retry on
  // auth (401/403) — those won't recover and the user needs to fix
  // the key.
  async function fetchOnce(): Promise<Response | { networkErr: Error }> {
    try {
      return await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });
    } catch (err) {
      return { networkErr: err as Error };
    }
  }
  function isTransient(s: number) {
    return s === 429 || s >= 500;
  }
  let res: Response;
  const first = await fetchOnce();
  if ("networkErr" in first) {
    await new Promise((r) => setTimeout(r, 250));
    const second = await fetchOnce();
    if ("networkErr" in second) {
      return { ok: false, error: second.networkErr.message ?? "Network error" };
    }
    res = second;
  } else if (isTransient(first.status)) {
    await new Promise((r) => setTimeout(r, 250));
    const second = await fetchOnce();
    if ("networkErr" in second) {
      return { ok: false, error: second.networkErr.message ?? "Network error" };
    }
    res = second;
  } else {
    res = first;
  }

  if (!res.ok) {
    let detail: string = res.statusText;
    try {
      const j = await res.json();
      detail = (j?.error?.message as string) ?? detail;
    } catch {
      /* keep statusText */
    }
    return { ok: false, error: `Whisper ${res.status}: ${detail}` };
  }

  type GroqVerboseJson = {
    text?: string;
    duration?: number;
    language?: string;
  };
  let data: GroqVerboseJson;
  try {
    data = (await res.json()) as GroqVerboseJson;
  } catch (err) {
    return { ok: false, error: `Bad response from Whisper: ${(err as Error).message}` };
  }

  const text = (data?.text ?? "").trim();
  if (!text) {
    // Real silence (e.g. user tapped record then stayed quiet) returns
    // an empty string. The caller should treat this as a no-op, not an
    // error.
    return { ok: true, text: "", durationSec: Number(data?.duration ?? 0), language: null, model: GROQ_WHISPER_MODEL };
  }

  return {
    ok: true,
    text,
    durationSec: typeof data?.duration === "number" ? data.duration : null,
    language: typeof data?.language === "string" ? data.language : null,
    model: GROQ_WHISPER_MODEL,
  };
}
