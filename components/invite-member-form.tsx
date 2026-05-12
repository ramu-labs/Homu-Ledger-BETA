"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Check } from "lucide-react";
import { inviteMember } from "@/app/actions/invitations";

export default function InviteMemberForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || pending) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await inviteMember(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Invitation sent.");
      setValue("");
      router.refresh();
      // Auto-clear success after 3s
      setTimeout(() => setSuccess(null), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="px-1 text-[12px] font-medium text-[var(--label-secondary)]">
        Invite by email or username
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setSuccess(null);
          }}
          placeholder="email@example.com or username"
          autoCapitalize="off"
          autoCorrect="off"
          className="h-12 flex-1 rounded-xl bg-[var(--surface)] px-3 text-[14px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.06] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[var(--foreground)] px-4 text-[13px] font-semibold text-[var(--on-foreground)] transition-opacity disabled:opacity-50 active:scale-[0.99]"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <UserPlus className="h-4 w-4" strokeWidth={2.5} />
          )}
          Invite
        </button>
      </div>
      {error && <p className="px-1 text-[12px] text-rose-600">{error}</p>}
      {success && (
        <p className="flex items-center gap-1 px-1 text-[12px] text-emerald-600">
          <Check className="h-3 w-3" strokeWidth={2.75} />
          {success}
        </p>
      )}
    </form>
  );
}
