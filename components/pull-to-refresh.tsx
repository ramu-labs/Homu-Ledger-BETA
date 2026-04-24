"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 72;

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1200);
  }, [router]);

  const lastRefreshTime = useRef(0);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return;
      const delta = Math.max(0, e.touches[0].clientY - startY.current);
      // Rubber-band: slow down past 40px
      const rubberband = delta < 40 ? delta : 40 + (delta - 40) * 0.3;
      setPullY(Math.min(rubberband, THRESHOLD + 20));
    }
    function onTouchEnd() {
      if (pullY >= THRESHOLD && !refreshing) {
        const now = Date.now();
        if (now - lastRefreshTime.current > 2000) {
          lastRefreshTime.current = now;
          onRefresh();
        }
      }
      setPullY(0);
      pulling.current = false;
      startY.current = 0;
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY, refreshing, onRefresh]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const showIndicator = pullY > 8 || refreshing;

  return (
    <div>
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: refreshing ? 48 : pullY > 0 ? pullY : 0 }}
      >
        {showIndicator && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] shadow-md ring-1 ring-black/[0.06] transition-transform"
            style={{ transform: `scale(${0.6 + progress * 0.4})` }}
          >
            {refreshing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--foreground)]/20 border-t-[var(--foreground)]" />
            ) : (
              <div
                className="h-4 w-4 rounded-full border-2 border-[var(--foreground)]/20 border-t-[var(--foreground)]"
                style={{ transform: `rotate(${progress * 720}deg)` }}
              />
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
