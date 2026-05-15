"use client";

// Sparkle-icon FAB that opens the voice-transactions screen.
//
// v1.43.1 history note: tried integrating into the header icon row in
// v1.43.0 — user reverted, found it too easy to miss in the cluster of
// chrome-tinted chips. Back to the floating coral disc style, bottom-
// right above the bottom-nav. Sparkle remains the only glyph (no mic).
//
// Position math:
//   • right: 18px — flush with the screen edge but not touching it
//   • bottom: env(safe-area-inset-bottom) + 96px — sits above the
//     bottom-nav (≈72px tall) with breathing room
//
// Offline behaviour: getUserMedia + Whisper need network. When
// navigator.onLine is false we render the button greyed out and
// disable taps rather than letting the user hit a dead end.

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
      className="fixed z-[49] inline-flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-[0_10px_22px_rgba(238,100,82,0.35)] transition-opacity active:scale-95 disabled:opacity-40 disabled:shadow-none [touch-action:manipulation]"
      style={{
        right: 18,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
        background: "#EE6452",
        animation: "speak-fab-in 360ms cubic-bezier(.22,1,.36,1) both",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center"
        style={{ animation: online ? "ai-sparkle-blink 2.8s ease-in-out infinite" : undefined }}
      >
        <SparkleStar />
      </span>
    </button>
  );
}

function SparkleStar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}>
      <path d="M12 2 L13.8 10.2 L22 12 L13.8 13.8 L12 22 L10.2 13.8 L2 12 L10.2 10.2 Z" />
    </svg>
  );
}
