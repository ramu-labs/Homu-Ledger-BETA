"use client";

// Small red count chip rendered next to the "Feedback Tickets" row on the
// Settings page for developers. Shows the number of tickets in status='open'
// (i.e. not yet in_progress or closed). Re-counts on any feedback row
// change via Realtime so the badge stays current without polling.
//
// Renders nothing when the count is zero so the row stays clean.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DevFeedbackBadge({ initialCount = 0 }: { initialCount?: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState<number>(initialCount);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { count } = await supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (!cancelled) setCount(count ?? 0);
    }
    // Always refresh on mount — the initial server-rendered count can be a
    // few seconds stale if a ticket arrives during navigation.
    refresh();

    const channel = supabase
      .channel("dev-feedback-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback" },
        () => { refresh(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (count <= 0) return null;
  return (
    <span className="mr-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
