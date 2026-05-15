"use client";

// Signed-in Devices — per-row two-step destructive flow.
//
// State machine per device row (idle → action → result):
//
//   ACTIVE
//      │
//      └── tap "Sign out" ──── (1st tap arms, button turns red,
//                              copy flips to "Tap again to sign out")
//             │
//             └── tap again ── runs signOutDeviceSession()
//                                 │
//                                 ▼
//                          SIGNED OUT (badge appears, "Sign out"
//                                       button is replaced by
//                                       "Delete")
//                                  │
//                                  └── tap "Delete" ── (1st tap arms,
//                                                       "Tap again to
//                                                       delete")
//                                         │
//                                         └── tap again ─ deleteDeviceSession()
//                                                            │
//                                                            ▼
//                                                   row removed from list
//
// Each "armed" state auto-cancels after 3s so a stray tap can't sit
// around as a one-tap-from-disaster trap (same pattern as the
// promo-code delete and AI key clear).
//
// The CURRENT device (the one you're reading this on) shows a
// "This device" badge instead of Sign-out/Delete buttons — you can't
// kick yourself off this page; for that there's the main Sign Out
// button in /settings. Bulk "Sign out all other devices" at the
// bottom handles the lost-phone case in one tap (with a confirm).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Trash2,
  LogOut,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import {
  signOutDeviceSession,
  deleteDeviceSession,
  signOutOtherDevices,
  renameDeviceSession,
} from "@/app/actions/auth";
import type { DeviceRow } from "@/app/(app)/settings/devices/page";

// Two-tap auto-cancel window. Matches the rest of the app.
const ARM_TIMEOUT_MS = 3000;

type Props = {
  devices: DeviceRow[];
};

export default function DevicesShell({ devices: initialDevices }: Props) {
  const router = useRouter();
  const t = useT();
  const [devices, setDevices] = useState<DeviceRow[]>(initialDevices);
  const [armedId, setArmedId] = useState<string | null>(null);
  // Distinct from armedId because Delete and Sign-out both arm the
  // row, but we want them to be different visual states. We pair
  // (id, action) — the action is what the second tap will do.
  const [armedAction, setArmedAction] = useState<"signout" | "delete" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk-action state. Separate from the per-row state because the
  // button has its own arming.
  const [bulkArmed, setBulkArmed] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Per-row rename state (v1.31.0). Only one row at a time can be in
  // edit mode — keeps the UI focused. `renameInput` mirrors the input
  // value so optimistic updates don't fight the controlled input.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);

  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bulkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      if (bulkTimerRef.current) clearTimeout(bulkTimerRef.current);
    };
  }, []);

  function disarmAll() {
    setArmedId(null);
    setArmedAction(null);
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }

  function arm(id: string, action: "signout" | "delete") {
    setError(null);
    setArmedId(id);
    setArmedAction(action);
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => {
      // Disarm if the user walks away. Only clear if we're still the
      // armed row + action (a fresh arm would have replaced us).
      setArmedId((cur) => (cur === id ? null : cur));
      setArmedAction((cur) => (cur === action ? null : cur));
      armTimerRef.current = null;
    }, ARM_TIMEOUT_MS);
  }

  async function onSignOutTap(d: DeviceRow) {
    if (busyId === d.id) return;
    // First tap on this row's sign-out → arm.
    if (armedId !== d.id || armedAction !== "signout") {
      arm(d.id, "signout");
      return;
    }
    // Confirmed: run.
    disarmAll();
    setBusyId(d.id);
    setError(null);
    const res = await signOutDeviceSession(d.id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    // Optimistic local flip — the row stays visible but now reads
    // "Signed out" and exposes the Delete affordance.
    setDevices((prev) =>
      prev.map((row) => (row.id === d.id ? { ...row, isSignedOut: true } : row))
    );
  }

  async function onDeleteTap(d: DeviceRow) {
    if (busyId === d.id) return;
    if (armedId !== d.id || armedAction !== "delete") {
      arm(d.id, "delete");
      return;
    }
    disarmAll();
    setBusyId(d.id);
    setError(null);
    const res = await deleteDeviceSession(d.id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDevices((prev) => prev.filter((row) => row.id !== d.id));
  }

  function startRename(d: DeviceRow) {
    // Disarm any in-progress sign-out/delete confirmation so the user
    // doesn't accidentally trigger a destructive action while typing.
    disarmAll();
    setRenamingId(d.id);
    setRenameInput(d.nickname);
    setError(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameInput("");
  }

  async function commitRename(d: DeviceRow) {
    if (renamingBusy) return;
    const next = renameInput.trim();
    // No-op if unchanged. Saves a needless round-trip when the user
    // hits enter without editing.
    if (next === d.nickname) {
      cancelRename();
      return;
    }
    setRenamingBusy(true);
    setError(null);
    const res = await renameDeviceSession(d.id, next);
    setRenamingBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDevices((prev) =>
      prev.map((row) => (row.id === d.id ? { ...row, nickname: next } : row))
    );
    cancelRename();
  }

  async function onBulkSignOutTap() {
    if (bulkBusy) return;
    if (!bulkArmed) {
      setBulkArmed(true);
      if (bulkTimerRef.current) clearTimeout(bulkTimerRef.current);
      bulkTimerRef.current = setTimeout(() => {
        setBulkArmed(false);
        bulkTimerRef.current = null;
      }, ARM_TIMEOUT_MS);
      return;
    }
    setBulkArmed(false);
    if (bulkTimerRef.current) {
      clearTimeout(bulkTimerRef.current);
      bulkTimerRef.current = null;
    }
    setBulkBusy(true);
    setError(null);
    const res = await signOutOtherDevices();
    setBulkBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    // Flip every non-current row to signed-out optimistically. Hard
    // refresh would also work, but the local update keeps the page
    // feeling instant on slow networks.
    setDevices((prev) =>
      prev.map((row) => (row.isCurrent ? row : { ...row, isSignedOut: true }))
    );
    // Background refresh in case the server has fresher state (e.g.
    // some devices already expired naturally).
    router.refresh();
  }

  const otherActiveCount = devices.filter((d) => !d.isCurrent && !d.isSignedOut).length;

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("settings.devices")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-3 text-[13px] text-[var(--label-secondary)]">
        {t("devices.subtitle")}
      </p>

      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {devices.map((d) => {
          const armed = armedId === d.id;
          const armedFor = armed ? armedAction : null;
          const busy = busyId === d.id;
          return (
            <li key={d.id} className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[22px] leading-none">{d.glyph}</span>
                <div className="min-w-0 flex-1">
                  {renamingId === d.id ? (
                    /* Inline rename: input replaces the label row.
                       Submit on Enter / blur, cancel on Escape /
                       cancel-button. Save button writes via the
                       renameDeviceSession action. */
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void commitRename(d);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelRename();
                        }}
                        autoFocus
                        maxLength={50}
                        placeholder={t("devices.nicknamePlaceholder")}
                        aria-label={t("devices.rename")}
                        className="h-9 flex-1 rounded-xl bg-[var(--background)] px-3 text-[14px] font-medium text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20"
                      />
                      <button
                        type="submit"
                        disabled={renamingBusy}
                        aria-label={t("common.save")}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EE6452] text-white disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        disabled={renamingBusy}
                        aria-label={t("common.cancel")}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-[var(--label-secondary)] ring-1 ring-black/[0.08] disabled:opacity-60"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                          {d.nickname || d.label}
                        </p>
                        {d.isCurrent && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            {t("devices.thisDevice")}
                          </span>
                        )}
                        {!d.isCurrent && d.isSignedOut && (
                          <span className="rounded-full bg-[var(--label-tertiary)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--label-secondary)]">
                            {t("devices.signedOut")}
                          </span>
                        )}
                        {/* Pencil — opens the rename form. Sized as
                            the badges so it sits on the same line
                            without breaking flow. */}
                        <button
                          onClick={() => startRename(d)}
                          aria-label={t("devices.rename")}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-black/[0.05] transition-colors [touch-action:manipulation]"
                        >
                          <Pencil className="h-3 w-3" strokeWidth={2.25} />
                        </button>
                      </div>
                      {/* When a nickname is set, surface the parsed
                          UA label as the subtitle so the user still
                          knows which physical device they renamed. */}
                      <p className="mt-0.5 truncate text-[12px] text-[var(--label-secondary)]">
                        {d.nickname ? (
                          <>
                            {d.label} ·{" "}
                            {formatRelative(d.refreshedAt ?? d.createdAt, {
                              justNow: t("devices.justNow"),
                              minutesAgo: t("devices.minutesAgo"),
                              hoursAgo: t("devices.hoursAgo"),
                              daysAgo: t("devices.daysAgo"),
                              monthsAgo: t("devices.monthsAgo"),
                            })}
                          </>
                        ) : (
                          formatRelative(d.refreshedAt ?? d.createdAt, {
                            justNow: t("devices.justNow"),
                            minutesAgo: t("devices.minutesAgo"),
                            hoursAgo: t("devices.hoursAgo"),
                            daysAgo: t("devices.daysAgo"),
                            monthsAgo: t("devices.monthsAgo"),
                          })
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Action row — under the device label so the buttons
                  have room to breathe and the "Tap again" copy fits
                  without truncation on narrow phones. Hidden entirely
                  for the current device (its action is the main Sign
                  Out button in /settings). */}
              {!d.isCurrent && (
                <div className="mt-3 flex justify-end gap-2">
                  {!d.isSignedOut ? (
                    <button
                      onClick={() => onSignOutTap(d)}
                      disabled={busy}
                      className={cn(
                        "flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors disabled:opacity-60 [touch-action:manipulation]",
                        armedFor === "signout"
                          ? "bg-rose-500 text-white"
                          : "bg-[var(--background)] text-rose-600 ring-1 ring-black/[0.06]"
                      )}
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {armedFor === "signout"
                        ? t("devices.signOutConfirm")
                        : busy
                        ? "…"
                        : t("devices.signOut")}
                    </button>
                  ) : (
                    <button
                      onClick={() => onDeleteTap(d)}
                      disabled={busy}
                      className={cn(
                        "flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors disabled:opacity-60 [touch-action:manipulation]",
                        armedFor === "delete"
                          ? "bg-rose-600 text-white"
                          : "bg-[var(--background)] text-rose-600 ring-1 ring-black/[0.06]"
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {armedFor === "delete"
                        ? t("devices.deleteConfirm")
                        : busy
                        ? "…"
                        : t("devices.delete")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mx-5 mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          {error}
        </p>
      )}

      {/* Bulk action — only show when there's something to bulk-sign-out. */}
      {otherActiveCount > 0 && (
        <section className="mx-5 mt-5">
          <button
            onClick={onBulkSignOutTap}
            disabled={bulkBusy}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-colors disabled:opacity-60 [touch-action:manipulation]",
              bulkArmed
                ? "bg-rose-600 text-white ring-1 ring-rose-600"
                : "bg-[var(--surface)] text-rose-600 ring-1 ring-black/[0.06]"
            )}
          >
            <LogOut className="h-4 w-4" strokeWidth={2.25} />
            {bulkBusy
              ? t("common.loading")
              : bulkArmed
              ? t("devices.bulkSignOutConfirm")
              : t("devices.bulkSignOut").replace("{n}", String(otherActiveCount))}
          </button>
          <p className="mt-2 px-1 text-[11px] text-[var(--label-tertiary)]">
            {t("devices.bulkSignOutHint")}
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Tiny relative-time helper. Takes the pre-translated label strings
 * directly (instead of the i18n `t` function) because `t` is typed to
 * the strict key union — passing it as a callable would force a
 * cast. Two-pieces-of-state is cleaner.
 */
type RelativeLabels = {
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  monthsAgo: string;
};
function formatRelative(iso: string, labels: RelativeLabels): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return labels.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${labels.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${labels.hoursAgo}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${labels.daysAgo}`;
  const months = Math.floor(days / 30);
  return `${months} ${labels.monthsAgo}`;
}
