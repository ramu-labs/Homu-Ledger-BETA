"use client";

// Mic FAB on the Transactions screen — opens the voice surface.
// Sits above the bottom nav, on the right. Coral background, white
// mic glyph, a small sparkle in the corner gently fades to signal
// "AI is here" without a heavy pulsing aura. See PRD §3.
//
// Offline: getUserMedia + Whisper both need network. When the browser
// is offline we render the FAB greyed out + non-interactive rather
// than letting the user tap into a dead end. (We still mount in the
// DOM so the layout doesn't shift when connectivity flickers.)

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
    // Prefetched by Next on hover; route push retains scroll position
    // back to /transactions when the voice screen exits.
    router.push("/transactions/voice");
  }

  return (
    <button
      onClick={open}
      disabled={!online}
      aria-label={t("voice.fab.aria") || "Speak to add transactions"}
      title={online ? t("voice.fab.aria") || "Speak to add transactions" : t("voice.fab.offline") || "Voice needs internet"}
      className="fixed z-[49] inline-flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-[0_10px_22px_rgba(238,100,82,0.35)] transition-opacity active:scale-95 disabled:opacity-40"
      style={{
        right: 18,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
        background: "#EE6452",
        animation: "speak-fab-in 360ms cubic-bezier(.22,1,.36,1) both",
      }}
    >
      <MicIcon />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-[4px] -top-[4px] inline-flex h-4 w-4 items-center justify-center text-white"
        style={{ animation: online ? "ai-sparkle-blink 2.8s ease-in-out infinite" : undefined }}
      >
        <SparkleStar />
      </span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function SparkleStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}>
      <path d="M12 2 L13.8 10.2 L22 12 L13.8 13.8 L12 22 L10.2 13.8 L2 12 L10.2 10.2 Z" />
    </svg>
  );
}
