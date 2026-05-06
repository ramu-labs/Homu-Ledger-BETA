"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { cancelInvitation } from "@/app/actions/invitations";

export default function CancelInviteButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [, startTransition] = useTransition();

  function handleCancel() {
    if (working) return;
    setWorking(true);
    startTransition(async () => {
      await cancelInvitation(invitationId);
      router.refresh();
      setWorking(false);
    });
  }

  return (
    <button
      onClick={handleCancel}
      disabled={working}
      aria-label="Cancel invitation"
      className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.04] text-[var(--label-secondary)] transition-colors active:bg-black/[0.08] disabled:opacity-50"
    >
      {working ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
      ) : (
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      )}
    </button>
  );
}
