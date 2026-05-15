"use client";

// Sparkle-icon button that opens the voice-transactions screen.
//
// v1.43.0 — rehomed from "floating coral FAB at bottom-right" to "small
// sparkle icon in the transactions header, next to the search + filter
// buttons". User feedback: the FAB was competing for thumb-reach with
// the bottom-nav "+" button, and a bottom-right coral disc was visually
// loud for what's effectively a power-user action. The header location
// keeps it discoverable but stops it dominating the page.
//
// Styling rationale:
//   • 36×36 round button, matching the existing IconButton dimensions.
//   • Coral background — same accent as the rest of the AI feature
//     surface (waveform stroke, edit-pulse). Distinguishes it from the
//     neutral search/filter chips at a glance without screaming.
//   • Sparkle is the ONLY glyph now. v1.42.x had a mic glyph + corner
//     sparkle, which felt like two ideas competing. The sparkle alone
//     reads as "AI" with no extra ink.
//   • The sparkle gently blinks via the existing ai-sparkle-blink
//     keyframes (2.8s ease loop). Stops when offline.
//
// Offline: getUserMedia + Whisper both need network. When the browser
// is offline we render the button disabled + greyed out rather than
// letting the user tap into a dead end.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";

export default function SpeakToAddFab() {
  const router = useRouter();
  const t = useT();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function open() {
    router.push("/transactions/voice");
  }

  return (
    <button
      onClick={open}
      disabled={!online}
      aria-label={t("voice.fab.aria") || "Speak to add transactions"}
      title={online ? t("voice.fab.aria") || "Speak to add transactions" : t("voice.fab.offline") || "Voice needs internet"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_2px_6px_rgba(238,100,82,0.30)] ring-1 ring-[#EE6452]/40 transition-all active:scale-95 disabled:opacity-40 disabled:shadow-none [touch-action:manipulation]"
      style={{ background: "#EE6452" }}
    >
      <span
        aria-hidden
        className="inline-flex h-4 w-4 items-center justify-center"
        style={{ animation: online ? "ai-sparkle-blink 2.8s ease-in-out infinite" : undefined }}
      >
        <SparkleStar />
      </span>
    </button>
  );
}

function SparkleStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}>
      <path d="M12 2 L13.8 10.2 L22 12 L13.8 13.8 L12 22 L10.2 13.8 L2 12 L10.2 10.2 Z" />
    </svg>
  );
}
