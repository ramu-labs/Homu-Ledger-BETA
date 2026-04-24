"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // If there's already a controller, a new SW taking over means an update.
    // Reload so the page gets fresh HTML + JS instead of showing stale content.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // Explicitly check for a new SW on every page load (browser also checks
        // automatically, but this makes updates land faster after a deploy).
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn("SW registration failed:", err));
  }, []);

  return null;
}
