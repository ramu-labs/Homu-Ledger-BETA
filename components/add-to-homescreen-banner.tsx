"use client";

import { useEffect, useState } from "react";
import { X, Share, PlusSquare } from "lucide-react";

type Platform = "ios" | "android" | null;

export default function AddToHomescreenBanner() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  useEffect(() => {
    // Already installed as PWA — don't show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // Only show on mobile
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      setPlatform("ios");
    } else if (isAndroid) {
      setPlatform("android");
    }
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  }

  if (dismissed || !platform) return null;
  // For Android, only show if we have the deferred prompt
  if (platform === "android" && !deferredPrompt) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col">
      {/* Main banner */}
      <div className="flex items-center gap-3 bg-[var(--foreground)] px-4 py-3 shadow-lg">
        {/* App icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl">
          💰
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-tight">
            Add FamilyLedger to Home Screen
          </p>
          <p className="text-[11px] text-white/60 mt-0.5 leading-tight">
            {platform === "ios"
              ? "Tap the share button below, then 'Add to Home Screen'"
              : "Install for quick access from your home screen"}
          </p>
        </div>

        {platform === "ios" ? (
          <button
            onClick={() => setShowIOSSteps((v) => !v)}
            className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white active:bg-white/25"
          >
            How?
          </button>
        ) : (
          <button
            onClick={handleAndroidInstall}
            className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white active:bg-white/25"
          >
            Install
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 active:bg-white/20"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* iOS step-by-step dropdown */}
      {platform === "ios" && showIOSSteps && (
        <div className="bg-[var(--surface)] border-b border-[var(--separator)] px-4 py-3 shadow-md space-y-2.5">
          <Step number={1} icon={<Share className="h-4 w-4" />} text="Tap the Share button in Safari's toolbar" />
          <Step number={2} icon={<PlusSquare className="h-4 w-4" />} text='Scroll down and tap "Add to Home Screen"' />
          <Step number={3} icon={<span className="text-base">✅</span>} text='Tap "Add" — done! Open FamilyLedger like any app' />
        </div>
      )}
    </div>
  );
}

function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-white text-[11px] font-bold">
        {number}
      </div>
      <div className="flex items-center gap-2 text-[var(--label-secondary)]">
        {icon}
        <p className="text-[13px]">{text}</p>
      </div>
    </div>
  );
}
