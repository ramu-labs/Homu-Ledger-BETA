"use client";

// Scribble waveform — a single horizontal line that bobs with mic
// volume. Drives one SVG path via requestAnimationFrame. The path is
// the sum of three sines whose amplitude is scaled by `volume` (0..1).
// When the mic is paused or quiet, the line eases to a near-flat
// heartbeat. See PRD §5.
//
// Why an SVG path and not a canvas? At 320×80 with ~70 points per
// frame the SVG is plenty efficient on mobile, and it scales crisply
// to the safe-area width without manual DPR handling.

import { useEffect, useRef } from "react";

type Props = {
  /** Current mic volume in 0..1. Driven by the mic-capture meterLoop. */
  volume: number;
  /** False when paused — drops volume to a flat-line. */
  listening: boolean;
  /** Stroke colour. Defaults to coral (the listen accent token). */
  color?: string;
};

export default function VoiceWaveform({ volume, listening, color = "#EE6452" }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  // Mirror props into a ref so the rAF loop reads the latest values
  // without re-attaching (re-attaching would reset the t=0 baseline
  // and cause a visible scribble glitch every prop change).
  const stateRef = useRef({ vol: 0.05, target: 0.05, listening: true });
  stateRef.current.target = listening ? volume : 0.02;
  stateRef.current.listening = listening;

  useEffect(() => {
    let frame: number | null = null;
    let lastT = performance.now();
    const W = 320;
    const H = 80;
    const N = 70;

    function buildPath(t: number, vol: number): string {
      const mid = H / 2;
      const parts: string[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = u * W;
        // Three octaves so the line never reads as a pure sine.
        const yRaw =
          Math.sin(t * 0.0019 + u * 8) * vol * H * 0.30 +
          Math.sin(t * 0.0033 + u * 14) * vol * H * 0.18 +
          Math.sin(t * 0.0011 + u * 5) * vol * H * 0.12;
        // Edge taper so the ends never whip out the side of the box.
        const taper = Math.sin(Math.PI * u);
        const y = mid + yRaw * taper;
        parts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      return "M " + parts.join(" L ");
    }

    function tick(now: number) {
      const dt = Math.min(0.06, (now - lastT) / 1000);
      lastT = now;
      const s = stateRef.current;
      // Speed of approach toward target. Faster while listening so the
      // wave responds to real mic spikes; slower when paused so it
      // glides into the heartbeat.
      const speed = s.listening ? 6 : 3;
      s.vol += (s.target - s.vol) * Math.min(1, dt * speed);
      if (pathRef.current) pathRef.current.setAttribute("d", buildPath(now, s.vol));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="flex w-full items-center justify-center">
      <svg viewBox="0 0 320 80" width="100%" height={64} preserveAspectRatio="none"
        style={{ display: "block", maxWidth: 320 }}>
        <path ref={pathRef} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
