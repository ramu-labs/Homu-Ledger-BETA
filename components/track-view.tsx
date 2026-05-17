"use client";

// Fires a single event once on mount (RAM-19). For instrumenting
// server-component pages that have no client entry point of their own —
// drop <TrackView event="..." /> into the page tree.

import { useEffect } from "react";
import { logEvent, type EventName } from "@/lib/events";

export default function TrackView({ event }: { event: EventName }) {
  useEffect(() => {
    logEvent(event);
  }, [event]);
  return null;
}
