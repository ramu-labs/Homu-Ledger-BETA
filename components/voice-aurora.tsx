"use client";

// Animated aurora background for the voice screen. Three large blurred
// blobs drifting on staggered ease-in-out keyframes. PRD §4.1.
//
// We use CSS variables for colours so the same component works in
// light + dark mode without a runtime check — `--voice-aurora-*` are
// declared in app/globals.css under the [data-theme] selectors.
//
// `prefers-reduced-motion` is respected by pausing the keyframes via
// `animation-play-state: paused` (handled in globals.css).

export default function VoiceAurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-[20%] -top-[18%] h-[55vh] w-[80vw] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, var(--voice-aurora-1, oklch(0.82 0.10 60)) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "aurora-drift-0 28s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[18%] top-[10%] h-[60vh] w-[78vw] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, var(--voice-aurora-2, oklch(0.78 0.13 25)) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "aurora-drift-1 34s ease-in-out infinite",
          animationDelay: "-9s",
        }}
      />
      <div
        className="absolute -bottom-[15%] left-[10%] h-[50vh] w-[80vw] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, var(--voice-aurora-3, oklch(0.85 0.07 80)) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "aurora-drift-2 22s ease-in-out infinite",
          animationDelay: "-14s",
        }}
      />
    </div>
  );
}
