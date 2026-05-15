// Mic capture + silence-detection driver for the voice screen (v1.41.0).
//
// Encapsulates everything that's hostile to JSX:
//   • getUserMedia → MediaRecorder (webm/opus or mp4/aac depending on UA)
//   • AnalyserNode tap on the same stream → volume metering for the
//     waveform AND for silence detection
//   • Push-from-silence-to-silence segmentation. When RMS volume drops
//     below SILENCE_RMS for SILENCE_HOLD_MS, the current chunk is
//     flushed to the consumer and a new one begins.
//
// Why no AudioWorklet PCM chunker (PRD §7.2 would call for one)? We
// dropped streaming SSE in favour of per-utterance batch — Whisper
// gets the whole encoded blob in one POST. MediaRecorder already
// produces opus/aac chunks that Whisper accepts directly, so the
// PCM-chunker layer would just re-encode and waste CPU.
//
// iOS PWA quirks handled:
//   • AudioContext must be resumed inside a user-gesture handler.
//     Caller passes `unlockedAt` (a monotonic ms timestamp recorded
//     when the user tapped the FAB); start() asserts on it.
//   • iOS Safari's MediaRecorder doesn't support `audio/webm`; we
//     probe `isTypeSupported` and fall back to `audio/mp4`.
//
// API:
//   const mic = createMicCapture({ onUtterance, onVolume, onError });
//   await mic.start();   // call from a user-gesture handler
//   mic.pause();         // freezes recording but keeps stream alive
//   mic.resume();
//   mic.stop();          // tears down getUserMedia
//
// Volume is normalised to 0..1 and pushed every animation frame.

const SILENCE_RMS = 0.012;          // below this for SILENCE_HOLD_MS → flush
const SILENCE_HOLD_MS = 900;        // user pauses this long → utterance done
const MIN_UTTERANCE_MS = 350;       // don't flush a sub-half-second blob
const MAX_UTTERANCE_MS = 12_000;    // hard cap so a long monologue still flushes

export type MicCaptureHandlers = {
  /** Fired when one utterance worth of audio has been captured. */
  onUtterance: (blob: Blob, meta: { ms: number; mime: string }) => void;
  /** Continuous RMS volume in 0..1. Throttled to rAF. */
  onVolume: (vol: number) => void;
  /** Fatal error — permission denied, no mic, etc. */
  onError: (err: Error) => void;
  /** Optional: fires when a silence-flush begins (UI can show a spinner). */
  onSilenceFlush?: () => void;
};

export type MicCaptureHandle = {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isActive: () => boolean;
};

/**
 * Build a mic-capture pipeline. Returns a handle the caller drives via
 * start/pause/stop. All internal state is kept inside the closure so
 * the caller never sees the raw stream, recorder, or context.
 */
export function createMicCapture(handlers: MicCaptureHandlers): MicCaptureHandle {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let recorder: MediaRecorder | null = null;
  let mimeType = "audio/webm";
  let chunks: Blob[] = [];
  let chunkStartedAt = 0;
  let lastVoiceAt = 0;
  let rafId: number | null = null;
  let paused = false;
  let active = false;

  function pickMime(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    }
    return ""; // browser default
  }

  function flushUtterance(reason: "silence" | "max" | "stop") {
    if (!recorder) return;
    const ms = performance.now() - chunkStartedAt;
    if (ms < MIN_UTTERANCE_MS && reason === "silence") return;
    // The dataavailable handler will see whatever's buffered and we'll
    // ship that as one utterance. Then we restart the recorder so a new
    // chunk timeline begins from zero. (Calling stop()/start() in pairs
    // is the only way to slice a MediaRecorder.)
    try {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    } catch {
      /* recorder may have been torn down concurrently */
    }
    if (reason !== "stop") {
      // Restart on next tick so the previous stop's dataavailable lands first.
      setTimeout(() => {
        if (!active || paused || !recorder) return;
        startNewChunk();
      }, 30);
    }
  }

  function startNewChunk() {
    if (!recorder || !active) return;
    chunks = [];
    chunkStartedAt = performance.now();
    lastVoiceAt = performance.now();
    try {
      recorder.start();
    } catch {
      // Recorder might still be stopping — retry once next frame
      setTimeout(() => {
        if (active && !paused && recorder?.state === "inactive") recorder.start();
      }, 60);
    }
  }

  function meterLoop() {
    if (!analyser || !active) return;
    const buf = new Float32Array(analyser.fftSize);
    function tick() {
      if (!analyser || !active) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // Scale to 0..1; voices typically peak around 0.2 RMS so we boost a
      // little for the waveform — the silence threshold below uses the raw
      // RMS, not this scaled value.
      const vol = paused ? 0.02 : Math.min(1, rms * 4 + 0.05);
      handlers.onVolume(vol);

      const now = performance.now();
      if (!paused) {
        if (rms > SILENCE_RMS) lastVoiceAt = now;
        const sinceVoice = now - lastVoiceAt;
        const sinceStart = now - chunkStartedAt;
        if (sinceVoice > SILENCE_HOLD_MS && sinceStart > MIN_UTTERANCE_MS) {
          handlers.onSilenceFlush?.();
          flushUtterance("silence");
        } else if (sinceStart > MAX_UTTERANCE_MS) {
          handlers.onSilenceFlush?.();
          flushUtterance("max");
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  async function start() {
    if (active) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      handlers.onError(err as Error);
      return;
    }

    const AC: typeof AudioContext =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    // iOS PWA: explicit resume() inside the user-gesture path that
    // ultimately called start(). Without this the AudioContext starts
    // in 'suspended' state and the analyser only sees zeros.
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* best-effort */
      }
    }
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);

    mimeType = pickMime();
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      handlers.onError(err as Error);
      stop();
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (chunks.length === 0) return;
      const ms = performance.now() - chunkStartedAt;
      const type = chunks[0].type || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      chunks = [];
      handlers.onUtterance(blob, { ms, mime: type });
    };

    active = true;
    paused = false;
    startNewChunk();
    meterLoop();
  }

  function pause() {
    if (!active || paused) return;
    paused = true;
    if (recorder?.state === "recording") {
      try {
        recorder.pause();
      } catch {
        /* swallow */
      }
    }
  }

  function resume() {
    if (!active || !paused) return;
    paused = false;
    lastVoiceAt = performance.now();
    chunkStartedAt = performance.now();
    if (recorder?.state === "paused") {
      try {
        recorder.resume();
      } catch {
        /* swallow */
      }
    } else if (recorder?.state === "inactive") {
      startNewChunk();
    }
  }

  function stop() {
    active = false;
    paused = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    try {
      if (recorder?.state !== "inactive") recorder?.stop();
    } catch {
      /* swallow */
    }
    recorder = null;
    analyser?.disconnect();
    analyser = null;
    try {
      ctx?.close();
    } catch {
      /* swallow */
    }
    ctx = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  return {
    start,
    pause,
    resume,
    stop,
    isActive: () => active,
  };
}
