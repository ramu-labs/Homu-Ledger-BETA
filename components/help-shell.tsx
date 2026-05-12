"use client";

// Wraps the Help & Feedback page in a two-tab shell:
//   - "Submit"     → the existing FeedbackForm (write a new ticket)
//   - "My tickets" → list of tickets the user has submitted, with live updates
//
// Tab state is mirrored to the URL search param `?tab=mine` so deep links
// (e.g. from a future "you got a reply" notification) can land directly on
// the My-tickets pane.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import FeedbackForm from "@/components/feedback-form";
import MyTicketsList from "@/components/my-tickets-list";

type Tab = "submit" | "mine";

export default function HelpShell({ userId }: { userId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const initial: Tab = params.get("tab") === "mine" ? "mine" : "submit";
  const [tab, setTab] = useState<Tab>(initial);

  // Keep the URL search param in sync so reload / share preserves the tab.
  // Replace (not push) so the back button still leaves the page, not the tab.
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (tab === "mine") sp.set("tab", "mine");
    else sp.delete("tab");
    const qs = sp.toString();
    router.replace(qs ? `/settings/help?${qs}` : "/settings/help", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <>
      <div className="px-5 pt-2">
        <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          <TabButton active={tab === "submit"} onClick={() => setTab("submit")} label="Submit" />
          <TabButton active={tab === "mine"}   onClick={() => setTab("mine")}   label="My tickets" />
        </div>
      </div>

      {tab === "submit" ? (
        <>
          <p className="px-6 pt-4 pb-4 text-[13px] text-[var(--label-secondary)]">
            Found a bug, want a feature, or just confused? Send it our way — we read every one.
          </p>
          <FeedbackForm userId={userId} />
        </>
      ) : (
        <MyTicketsList userId={userId} />
      )}
    </>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--label-secondary)]"
      )}
    >
      {label}
    </button>
  );
}
