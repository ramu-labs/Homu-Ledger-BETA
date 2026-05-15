"use client";

import { useEffect, useState } from "react";

/**
 * Brand splash shown once on cold launch — covers the gap between the
 * iOS PWA's native launch flash and the first paint of the app.
 *
 * Renders cream (matching the manifest theme_color and the page bg) with
 * the Homu icon centered and a gentle breathing animation, then fades out.
 * Only mounts on initial render; subsequent client-side navigations don't
 * re-trigger it because the component starts in its visible state and
 * unmounts itself, then never mounts again until a full reload.
 */
export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Show for ~900ms total (visible long enough to register, short enough
    // not to feel like a blocker), then fade out over 400ms before
    // unmounting.
    const fade = setTimeout(() => setHidden(true), 900);
    const remove = setTimeout(() => setRemoved(true), 1300);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-[400ms] ease-out ${
        hidden ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      // v1.39.0 — use the design-system background var instead of the
      // hardcoded cream. The theme bootstrap in app/layout.tsx runs
      // beforeInteractive, so by the time React hydrates this splash
      // --background already resolves to either cream (light) or the
      // dark equivalent. Previously dark-mode users saw a cream splash
      // followed by a hard cut to the dark page.
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="flex flex-col items-center gap-4 animate-splash-breathe">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={88}
          height={88}
          // Drop-shadow uses currentColor opacity instead of a fixed
          // brown so it reads in both modes. Tailwind doesn't have a
          // pre-baked syntax for "current foreground at 8%" so the
          // shadow gets an explicit black-with-opacity that's tame
          // enough not to dominate either palette.
          className="rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          draggable={false}
        />
        <p className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          Homu
        </p>
      </div>
    </div>
  );
}
