"use client";

// Client-side event logger for funnel / drop-off analysis (RAM-19).
//
// Design goals:
//   • Bulletproof — logEvent NEVER throws and never blocks the UI. A
//     telemetry call must not be able to break a user flow.
//   • Consent-gated — nothing is collected unless analytics consent is
//     granted. Until RAM-20 ships the real consent UI the gate defaults
//     to OFF, so this logger is dormant; RAM-20 flips it via
//     setEventsConsent(). (Server-side consent enforcement also lands
//     with RAM-20 — this is the client gate only.)
//   • Offline-safe — events are buffered in localStorage and flushed in
//     batches when online (on load, on 'online', on tab focus). Modelled
//     on the sync-queue idea but kept separate: events are lossy
//     fire-and-forget telemetry, not critical mutations.

import { createClient } from "@/lib/supabase/client";

export type EventName =
  | "transaction_started"
  | "transaction_completed"
  | "category_picker_opened"
  | "category_selected"
  | "settings_opened";

// Small, non-identifying metadata only — never put PII in props.
type EventProps = Record<string, string | number | boolean>;

type BufferedEvent = {
  name: EventName;
  props: EventProps;
  client_ts: string;
};

const CONSENT_KEY = "homu.analytics.consent";
const BUFFER_KEY = "homu.analytics.eventbuf";
const BUFFER_CAP = 500; // drop oldest beyond this — telemetry is lossy
const FLUSH_BATCH = 50;
const FLUSH_DEBOUNCE_MS = 2000;

const isBrowser = () => typeof window !== "undefined";

// ── Consent ────────────────────────────────────────────────────────────
export function getEventsConsent(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Wired by the RAM-20 consent flow. Granting also kicks a flush. */
export function setEventsConsent(granted: boolean): void {
  if (!isBrowser()) return;
  try {
    if (granted) window.localStorage.setItem(CONSENT_KEY, "1");
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* storage unavailable — nothing to do */
  }
  if (granted) scheduleFlush();
}

// ── Buffer ─────────────────────────────────────────────────────────────
function readBuffer(): BufferedEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    return raw ? (JSON.parse(raw) as BufferedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: BufferedEvent[]): void {
  if (!isBrowser()) return;
  try {
    // Keep only the most recent BUFFER_CAP — oldest dropped first.
    window.localStorage.setItem(BUFFER_KEY, JSON.stringify(events.slice(-BUFFER_CAP)));
  } catch {
    /* quota / unavailable — drop silently */
  }
}

// ── Public: log an event ───────────────────────────────────────────────
/** Fire-and-forget. Never throws, never blocks. No-op without consent. */
export function logEvent(name: EventName, props: EventProps = {}): void {
  try {
    if (!isBrowser() || !getEventsConsent()) return;
    const buf = readBuffer();
    buf.push({ name, props, client_ts: new Date().toISOString() });
    writeBuffer(buf);
    scheduleFlush();
  } catch {
    /* telemetry must never surface an error to the caller */
  }
}

// ── Flush ──────────────────────────────────────────────────────────────
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleFlush(): void {
  if (!isBrowser() || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (!isBrowser() || flushing) return;
  if (!navigator.onLine) return; // retry on reconnect
  const buf = readBuffer();
  if (buf.length === 0) return;
  flushing = true;
  try {
    const batch = buf.slice(0, FLUSH_BATCH);
    const supabase = createClient();
    const { error } = await supabase
      .from("events")
      .insert(batch.map((e) => ({ name: e.name, props: e.props, client_ts: e.client_ts })));
    if (!error) {
      // Drop the events just sent; keep any logged during the await.
      writeBuffer(readBuffer().slice(batch.length));
      if (readBuffer().length > 0) scheduleFlush();
    }
    // On error: leave the buffer intact and retry on the next trigger.
  } catch {
    /* network / other — keep buffer, retry later */
  } finally {
    flushing = false;
  }
}

// ── Flush triggers ─────────────────────────────────────────────────────
if (isBrowser()) {
  window.addEventListener("online", () => scheduleFlush());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFlush();
  });
  // Drain anything left buffered from a previous session.
  scheduleFlush();
}
