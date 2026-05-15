"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Check, LogIn, Mail, Loader2 } from "lucide-react";
import { switchHousehold } from "@/app/actions/households";
import { acceptInvitation, declineInvitation, joinLedgerByCode } from "@/app/actions/invitations";
import type { DbHouseholdMembership, DbPendingInvitation } from "@/lib/types";

type Props = {
  memberships: DbHouseholdMembership[];
  pendingInvitations?: DbPendingInvitation[];
  currentHouseholdId: string;
  onClose: () => void;
};

// v1.38.1 — the inline "create" form is gone; tapping Create now
// closes the sheet and navigates to /settings/new-ledger, which uses
// the same 3-step flow as initial onboarding. Kept the Mode type as a
// 2-way switch (list / join) so the rest of the file reads cleanly.
type Mode = "list" | "join";

export default function LedgerSwitcherSheet({
  memberships,
  pendingInvitations = [],
  currentHouseholdId,
  onClose,
}: Props) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("list");

  // Join form
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  // Invitation actions
  const [inviteWorking, setInviteWorking] = useState<string | null>(null);

  async function handleSwitch(householdId: string) {
    if (householdId === currentHouseholdId) {
      onClose();
      return;
    }
    setSwitching(householdId);
    const result = await switchHousehold(householdId);
    if (result.error) {
      setSwitching(null);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    const result = await joinLedgerByCode(joinCode);
    if (result.error) {
      setJoinError(result.error);
      setJoining(false);
    } else {
      router.refresh();
      onClose();
    }
  }

  async function handleAccept(invitationId: string) {
    setInviteWorking(invitationId);
    const result = await acceptInvitation(invitationId);
    if (result.error) {
      setInviteWorking(null);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDecline(invitationId: string) {
    setInviteWorking(invitationId);
    const result = await declineInvitation(invitationId);
    setInviteWorking(null);
    if (result.error) return;
    router.refresh();
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 z-[90] flex max-h-[85dvh] w-full max-w-md -translate-x-1/2 flex-col rounded-t-3xl bg-[var(--surface)]">
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>
        <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-1">
          <h3 className="text-[17px] font-semibold text-[var(--foreground)]">My Ledgers</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* Pending invitations */}
          {pendingInvitations.length > 0 && (
            <>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
                Invitations
              </p>
              <ul className="mb-4 space-y-2">
                {pendingInvitations.map((inv) => {
                  const working = inviteWorking === inv.id;
                  return (
                    <li
                      key={inv.id}
                      className="overflow-hidden rounded-2xl bg-[var(--background)] ring-1 ring-blue-500/20"
                    >
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[20px] ring-1 ring-black/[0.06]">
                          {inv.household.symbol ?? "🏠"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                            {inv.household.name}
                          </p>
                          <p className="truncate text-[12px] text-[var(--label-secondary)]">
                            Invited by {inv.inviter?.name ?? "someone"} · {inv.household.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 border-t border-[var(--separator)] px-3 py-2">
                        <button
                          onClick={() => handleDecline(inv.id)}
                          disabled={working}
                          className="flex h-10 flex-1 items-center justify-center rounded-xl bg-transparent text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-50 active:bg-black/[0.04]"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleAccept(inv.id)}
                          disabled={working}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--foreground)] text-[13px] font-semibold text-[var(--on-foreground)] disabled:opacity-60 active:scale-[0.99]"
                        >
                          {working ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                          ) : (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
                          )}
                          Accept
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
                Your ledgers
              </p>
            </>
          )}

          {/* Memberships */}
          <ul className="overflow-hidden rounded-2xl bg-[var(--background)] ring-1 ring-black/[0.06] divide-y divide-[var(--separator)]">
            {memberships.map(({ household_id, role, household }) => {
              const isCurrent = household_id === currentHouseholdId;
              const isLoading = switching === household_id;
              return (
                <li key={household_id}>
                  <button
                    onClick={() => handleSwitch(household_id)}
                    disabled={!!switching}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-black/[0.02] disabled:opacity-60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[20px] ring-1 ring-black/[0.06]">
                      {(household as any).symbol ?? "🏠"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{household.name}</p>
                      <p className="text-[12px] text-[var(--label-secondary)]">
                        {role === "owner" ? "Owner" : "Member"} · {household.currency}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--foreground)]">
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                    {isLoading && (
                      <span className="text-[12px] text-[var(--label-secondary)]">Switching…</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pb-8 pt-4">
          {mode === "list" && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode("join")}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3.5 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
              >
                <LogIn className="h-4 w-4" strokeWidth={2.25} />
                Join Ledger
              </button>
              <button
                onClick={() => {
                  // v1.38.1 — close the sheet first so the navigation
                  // stack stays clean, then route to /settings/new-ledger
                  // which renders the same 3-step LedgerSetupFlow used
                  // by initial onboarding.
                  onClose();
                  router.push("/settings/new-ledger");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] py-3.5 text-[14px] font-semibold text-[var(--on-foreground)] transition-colors active:opacity-90"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                Create
              </button>
            </div>
          )}

          {/* mode === "create" inline form removed in v1.38.1 — see
              the Create button above; tapping it now routes to
              /settings/new-ledger which renders the shared 3-step
              LedgerSetupFlow. */}

          {mode === "join" && (
            <form onSubmit={handleJoin} className="space-y-3">
              <p className="text-[13px] font-medium text-[var(--label-secondary)]">Enter invite code</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="6-character code"
                required
                autoFocus
                maxLength={6}
                className="h-12 w-full rounded-xl bg-[var(--background)] px-3 font-mono text-[18px] tracking-[0.18em] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20"
              />
              {joinError && <p className="text-[12px] text-rose-600">{joinError}</p>}
              <p className="text-[11px] text-[var(--label-tertiary)] flex items-start gap-1.5">
                <Mail className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={2} />
                Or ask the ledger owner to invite you by email or username — invitations appear at the top of this list.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setJoinError(null);
                    setJoinCode("");
                  }}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--background)] text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 4}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--foreground)] text-[14px] font-semibold text-[var(--on-foreground)] transition-opacity disabled:opacity-60"
                >
                  {joining ? "Joining…" : "Join"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
