"use client";

// Full-screen voice transactions surface (v1.41.0).
//
// Owns:
//   • createMicCapture lifecycle (start on mount, stop on unmount,
//     pause/resume from the footer button)
//   • Per-utterance pipeline: silence-flushed Blob → server actions
//     transcribeVoiceAudio + parseVoiceUtterance → reducer dispatch
//   • Draft row list + version-bump animations
//   • Tap-edit popovers for wallet/category (delegated to voice-row)
//   • Save flow — fans each draft out via queuedAddTransaction or
//     queuedAddTransfer, then closes the screen
//
// Layout (top → bottom):
//   ┌──────────────────────────────────────────┐
//   │ [×]   Speak to add                       │  header
//   ├──────────────────────────────────────────┤
//   │  (scrollable row list, packs from top)   │  list
//   ├──────────────────────────────────────────┤
//   │ "caption text"                           │  caption
//   │ [⏸]  ~~~~ waveform ~~~~  [✓ Save N]      │  controls
//   └──────────────────────────────────────────┘
//
// Why a single big client component? The state graph is heavily
// coupled — caption, mic, reducer, popover focus, save status all
// chain reactively. Splitting them would force prop-drilling 8+ deep
// for an ephemeral surface. The row component IS extracted because
// its edit-pulse refs need component-local lifecycle.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import VoiceAurora from "@/components/voice-aurora";
import VoiceWaveform from "@/components/voice-waveform";
import VoiceRow from "@/components/voice-row";
import { transcribeVoiceAudio, parseVoiceUtterance, recordVoiceCategoryUsage } from "@/app/actions/voice";
import { queuedAddTransaction } from "@/lib/queue-actions";
import { addTransfer } from "@/app/actions/transactions";
import { createMicCapture, type MicCaptureHandle } from "@/lib/voice/mic-capture";
import { useT } from "@/lib/i18n/provider";
import type { DbCategory, DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";
import type {
  ParsedTransaction,
  ParsedTransfer,
  VoiceAction,
  VoiceDraft,
  VoiceTarget,
} from "@/lib/voice/types";

type Props = {
  categories: DbCategory[];
  wallets: DbWallet[];
  currency: string;
  languageHint?: "auto" | "en" | "id" | null;
  /** v1.42.0 — pipe through the user's icon preference so voice rows
   *  match the rest of the app's category iconography. */
  iconStyle?: IconStyle;
};

export default function VoiceShell({ categories, wallets, currency, languageHint = "auto", iconStyle = "3d" }: Props) {
  const router = useRouter();
  const t = useT();

  const [rows, setRows] = useState<VoiceDraft[]>([]);
  const [paused, setPaused] = useState(false);
  const [utterance, setUtterance] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.05);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  // The mic-capture handle survives the entire screen lifecycle. We
  // keep it in a ref so re-renders don't re-create it; cleanup happens
  // in the unmount effect below.
  const micRef = useRef<MicCaptureHandle | null>(null);

  // Track the most-recent row id so "delete the last one" can resolve
  // without searching. Updated inside the reducer.
  const lastAddedIdRef = useRef<string | null>(null);

  // Mirror `rows` into a ref. The mic-capture effect is bound once on
  // mount (no rows in its deps) so closure-captured `rows` would be
  // permanently stale. Reading from the ref each time gives us the
  // latest list without re-binding the mic pipeline.
  const rowsRef = useRef<VoiceDraft[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // ── Resolve a Gemini target → row id ────────────────────────────────
  // Used for `update` and `remove` actions. Returns null if no row
  // matches; caller should treat that as a soft failure (no toast on
  // mobile — just let the user retry).
  const resolveTarget = useCallback((target: VoiceTarget): string | null => {
    if (target.mostRecent) return lastAddedIdRef.current;
    if (target.name) {
      const needle = target.name.toLowerCase();
      // Walk in reverse so "the kopi" picks the latest of several.
      const matches = rowsRef.current.filter(
        (r) => !r.exiting && r.name.toLowerCase().includes(needle)
      );
      return matches.length ? matches[matches.length - 1].id : null;
    }
    return null;
  }, []);

  // ── Reducer: promote a ghost row based on Gemini's parsed action ────
  //
  // The flow is: an utterance comes in, we drop a ghost row at `ghostId`
  // with the raw transcript while we wait on Gemini. When the parse
  // returns:
  //   add      → in-place upgrade the ghost to a real ParsedTransaction
  //              (same id, so React keeps the DOM node and the row
  //              doesn't unmount → no flicker / no animation restart).
  //   transfer → drop the ghost, append a transfer row.
  //   update   → drop the ghost, patch the target row.
  //   remove   → drop the ghost, mark target exiting.
  //   noop     → drop the ghost silently.
  const promoteGhost = useCallback(
    (ghostId: string, action: VoiceAction) => {
      if (action.kind === "noop") {
        setRows((rs) => rs.filter((r) => r.id !== ghostId));
        return;
      }

      if (action.kind === "add") {
        lastAddedIdRef.current = ghostId;
        setRows((rs) =>
          rs.map((r) =>
            r.id === ghostId
              ? ({
                  ...action.tx,
                  id: ghostId,
                  version: 1,
                  changed: null,
                  ghost: false,
                } as ParsedTransaction)
              : r
          )
        );
        return;
      }

      if (action.kind === "transfer") {
        const id = crypto.randomUUID();
        const next: ParsedTransfer = {
          ...action.tx,
          id,
          type: "transfer",
          version: 1,
          changed: null,
        };
        lastAddedIdRef.current = id;
        setRows((rs) => [...rs.filter((r) => r.id !== ghostId), next]);
        return;
      }

      // update / remove → ghost is irrelevant, route through applyAction.
      setRows((rs) => rs.filter((r) => r.id !== ghostId));
      applyActionInternal(action);
    },
    // applyActionInternal is stable via useCallback below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Reducer: apply non-add VoiceActions (used by promoteGhost) ──────
  //
  // The original applyAction included add/transfer too, but with ghost
  // rows those branches are handled by promoteGhost. This helper exists
  // for the update/remove cases where the ghost is already gone.
  const applyActionInternal = useCallback(
    (action: VoiceAction) => {
      if (action.kind === "noop") return;
      if (action.kind === "add" || action.kind === "transfer") return; // handled by promoteGhost

      if (action.kind === "update") {
        const targetId = resolveTarget(action.target);
        if (!targetId) return;
        const patch = action.patch;
        // Determine which cell changed for the per-cell pop animation.
        // Priority follows the order Gemini's most likely to emit.
        const changed: VoiceDraft["changed"] =
          patch.amount !== undefined
            ? "amount"
            : patch.category_id !== undefined
              ? "category"
              : patch.wallet_id !== undefined
                ? "wallet"
                : patch.name !== undefined
                  ? "name"
                  : null;
        setRows((rs) =>
          rs.map((r) => {
            if (r.id !== targetId) return r;
            // Transfers can only have name/amount/wallet edits via voice
            // (and category never applies to a transfer). The picker
            // doesn't render category on transfer rows, so we just
            // drop category_id updates on transfers here.
            if (r.type === "transfer") {
              const next: ParsedTransfer = {
                ...r,
                ...(patch.name !== undefined ? { name: patch.name } : {}),
                ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
                version: r.version + 1,
                changed: changed === "category" ? null : (changed as ParsedTransfer["changed"]),
              };
              return next;
            }
            const nextExp: ParsedTransaction = {
              ...r,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
              ...(patch.category_id !== undefined ? { category_id: patch.category_id } : {}),
              ...(patch.wallet_id !== undefined ? { wallet_id: patch.wallet_id } : {}),
              version: r.version + 1,
              changed,
            };
            return nextExp;
          })
        );
        return;
      }

      if (action.kind === "remove") {
        const targetId = resolveTarget(action.target);
        if (!targetId) return;
        // Mark exiting so the row plays the exit animation, then
        // remove it from state 280ms later.
        setRows((rs) => rs.map((r) => (r.id === targetId ? { ...r, exiting: true } : r)));
        setTimeout(() => {
          setRows((rs) => rs.filter((r) => r.id !== targetId));
        }, 280);
        return;
      }
    },
    [resolveTarget]
  );

  // ── Mic capture lifecycle ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const mic = createMicCapture({
      onVolume: (v) => {
        if (!cancelled) setVolume(v);
      },
      onSilenceFlush: () => {
        if (!cancelled) setThinking(true);
      },
      onUtterance: async (blob, meta) => {
        if (cancelled) return;
        // Tiny blobs (false silence flush) — skip.
        if (blob.size < 1000) {
          setThinking(false);
          return;
        }
        // v1.42.0: a stable ghost-row id we generate UP-FRONT.
        // Whisper completes ~150ms after silence detect → we insert a
        // skeleton row at that id. Gemini completes ~600ms later → we
        // promote the SAME id from ghost to real (or drop it if Gemini
        // returns noop). The user sees the row land instantly with the
        // transcript text; it morphs in place when the parse is done.
        const ghostId = crypto.randomUUID();
        try {
          const fd = new FormData();
          fd.set("audio", blob, "utterance" + extFor(meta.mime));
          if (languageHint && languageHint !== "auto") fd.set("language_hint", languageHint);
          const transcribed = await transcribeVoiceAudio(fd);
          if (cancelled) return;
          if (!transcribed.ok) {
            setUtterance(null);
            setThinking(false);
            setSaveError(transcribed.error);
            return;
          }
          const text = transcribed.text.trim();
          if (!text) {
            setUtterance(null);
            setThinking(false);
            return;
          }
          setUtterance(text);

          // INSERT THE GHOST ROW NOW. We don't yet know if this will
          // resolve to add / update / remove / transfer / noop, so we
          // optimistically render it as an "add" placeholder. When
          // Gemini comes back:
          //   - add        → promote the same id to a real row
          //   - transfer   → swap the ghost out, append a transfer row
          //                  (different shape)
          //   - update     → drop the ghost, patch the targeted row
          //   - remove     → drop the ghost, mark targeted row exiting
          //   - noop       → drop the ghost silently
          setRows((rs) => [
            ...rs,
            {
              id: ghostId,
              name: text,
              amount: 0,
              type: "expense",
              category_id: null,
              wallet_id: null,
              version: 1,
              changed: null,
              ghost: true,
            } as ParsedTransaction,
          ]);

          // Parse — context built fresh from rowsRef so Gemini sees the
          // latest names (minus the ghost we just inserted; we strip it
          // here so the parser doesn't try to "update" itself).
          const parsed = await parseVoiceUtterance(text, {
            categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            wallets: wallets.map((w) => ({ id: w.id, name: w.name })),
            rows: rowsRef.current
              .filter((r) => !r.exiting && !r.ghost)
              .map((r) => ({ id: r.id, name: r.name })),
            defaultWalletId: wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? null,
          });
          if (cancelled) return;
          setThinking(false);
          if (!parsed.ok) {
            // Remove the ghost on error.
            setRows((rs) => rs.filter((r) => r.id !== ghostId));
            setSaveError(parsed.error);
            return;
          }
          // Promote the ghost based on the action kind.
          promoteGhost(ghostId, parsed.action);
          setTimeout(() => {
            if (!cancelled) setUtterance(null);
          }, 1500);
        } catch (err) {
          if (cancelled) return;
          // Clean up the ghost on any crash.
          setRows((rs) => rs.filter((r) => r.id !== ghostId));
          setThinking(false);
          setSaveError((err as Error).message ?? "Unknown error");
        }
      },
      onError: (err) => {
        if (cancelled) return;
        const msg = (err && err.message) || String(err);
        if (/permission|denied|notallowed/i.test(msg)) {
          setPermissionError(
            t("voice.error.permission") ||
              "Microphone permission denied. Open Settings to allow microphone access."
          );
        } else {
          setPermissionError(msg);
        }
      },
    });

    micRef.current = mic;
    void mic.start();

    return () => {
      cancelled = true;
      mic.stop();
      micRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTogglePause() {
    setPaused((p) => {
      const next = !p;
      if (next) micRef.current?.pause();
      else micRef.current?.resume();
      return next;
    });
  }

  // v1.42.0: ghosts (Whisper-done-but-Gemini-pending) are excluded
  // from save — they have amount=0 and would land as zero-rows.
  const liveRows = useMemo(() => rows.filter((r) => !r.exiting && !r.ghost), [rows]);
  // Count of all visible rows (incl. ghosts) for the close-confirmation
  // count — losing a ghost feels just as bad as losing a real row from
  // the user's POV.
  const visibleCount = useMemo(() => rows.filter((r) => !r.exiting).length, [rows]);

  // v1.42.0: "magical" save phase. Set `flying` on every row when the
  // user taps Save → CSS animates each row in turn (staggered) up + out
  // with a sparkle glow. We wait the animation duration then navigate.
  // The destination /transactions list has its own row-in animation, so
  // the user sees: voice rows fly away → page transition → real rows
  // appear in the list. Reads as "they were just absorbed."
  const [flying, setFlying] = useState(false);

  async function onSave() {
    if (!liveRows.length || saving) return;
    setSaving(true);
    setSaveError(null);
    // Pause the mic while we're committing — avoids racing a half-
    // captured utterance with the navigation away.
    micRef.current?.pause();

    const today = new Date().toISOString().split("T")[0];
    const defaultWalletId = wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? "";

    try {
      // Fire all saves in parallel. Each addTransaction goes through
      // queuedAddTransaction so an offline-mid-save (which shouldn't
      // happen because we disable the FAB offline, but) falls back to
      // the IDB queue instead of throwing.
      const tasks: Promise<{ error?: string } | { queued: true }>[] = liveRows.map((r) => {
        if (r.type === "transfer") {
          const fd = new FormData();
          fd.set("from_wallet_id", r.from_wallet_id);
          fd.set("to_wallet_id", r.to_wallet_id);
          fd.set("amount", String(r.amount));
          fd.set("name", r.name);
          fd.set("date", today);
          // Transfers don't go through the offline queue today — they
          // call the server action directly. Voice requires network
          // anyway so this is fine.
          return addTransfer(fd);
        }
        const fd = new FormData();
        fd.set("type", r.type);
        fd.set("name", r.name);
        fd.set("amount", String(r.amount));
        if (r.category_id) fd.set("category_id", r.category_id);
        if (r.wallet_id) fd.set("wallet_id", r.wallet_id);
        else if (defaultWalletId) fd.set("wallet_id", defaultWalletId);
        fd.set("date", today);
        return queuedAddTransaction(fd);
      });
      const results = await Promise.all(tasks);
      const firstError = results.find(
        (r) => r && "error" in r && typeof r.error === "string" && r.error
      ) as { error?: string } | undefined;
      if (firstError?.error) {
        setSaveError(firstError.error);
        setSaving(false);
        micRef.current?.resume();
        return;
      }

      // ── v1.42.0: write voice picks into the category_hints cache so
      //    future typed entries auto-suggest the same category. Mirrors
      //    what add-transaction-sheet does on its own save path. Fire-
      //    and-forget — if the cache write fails, the save itself is
      //    already done. ─────────────────────────────────────────────
      for (const r of liveRows) {
        if (r.type === "transfer") continue;
        if (!r.category_id || !r.name) continue;
        void recordVoiceCategoryUsage(r.name, r.category_id);
      }

      // ── Magical save phase. Trigger the fly-out animation on every
      //    row, wait its duration, then navigate. The .voice-row-fly
      //    keyframes are staggered via animation-delay so rows leave
      //    one after another (50ms apart) — feels like they're being
      //    absorbed into the bottom nav. ──────────────────────────────
      setFlying(true);
      const STAGGER_MS = 50;
      const FLY_DURATION_MS = 620;
      const totalMs = STAGGER_MS * liveRows.length + FLY_DURATION_MS;
      await new Promise((r) => setTimeout(r, Math.min(totalMs, 1100)));

      // Done — navigate back and refresh the list.
      router.push("/transactions");
      router.refresh();
    } catch (err) {
      setSaveError((err as Error).message ?? "Couldn't save");
      setSaving(false);
      setFlying(false);
      micRef.current?.resume();
    }
  }

  function onClose() {
    // v1.42.0: close-with-drafts confirmation. If there's anything in
    // the list the user could lose (real rows OR ghosts that are still
    // resolving), require a second tap on the X within 3s.
    if (visibleCount > 0 && !confirmingClose) {
      setConfirmingClose(true);
      if (closeArmRef.current) clearTimeout(closeArmRef.current);
      closeArmRef.current = setTimeout(() => {
        setConfirmingClose(false);
        closeArmRef.current = null;
      }, 3000);
      return;
    }
    router.back();
  }
  // Two-tap-to-close state. Same pattern as the AI key Clear button.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const closeArmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeArmRef.current) clearTimeout(closeArmRef.current);
  }, []);

  // Caption fallback copy — driven by mic state + list length.
  const captionFallback = paused
    ? t("voice.caption.paused") || "Paused · tap resume to keep going"
    : permissionError
      ? permissionError
      : liveRows.length === 0
        ? t("voice.caption.tryThis") || "Try: \"Bensin tiga ratus ribu\""
        : t("voice.caption.keepGoing") || "Keep going · or tap Save";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <VoiceAurora />

      <div className="relative z-[1] flex h-full flex-col">
        {/* Status-bar spacer */}
        <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
          <button
            onClick={onClose}
            aria-label={confirmingClose ? "Tap again to discard drafts" : t("common.close") || "Close"}
            className={cn(
              "flex h-9 items-center justify-center rounded-full text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 transition-all active:scale-95",
              confirmingClose
                ? "w-auto gap-1.5 bg-rose-500 px-3 text-[12px] font-semibold text-white ring-rose-500"
                : "w-9 bg-[var(--surface)] ring-black/[0.05]"
            )}
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
            {confirmingClose && <span>Discard {visibleCount}?</span>}
          </button>
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            {t("voice.title") || "Speak to add"}
          </h2>
          <div className="h-9 w-9" aria-hidden />
        </div>

        {/* Scrollable list — packs from the top */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[14px] pb-3 pt-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map((row, idx) => (
              <VoiceRow
                key={row.id}
                row={row}
                categories={categories}
                wallets={wallets}
                currency={currency}
                iconStyle={iconStyle}
                flying={flying}
                flyIndex={idx}
                onSetWallet={(walletId) =>
                  setRows((rs) =>
                    rs.map((r) =>
                      r.id === row.id
                        ? r.type === "transfer"
                          ? { ...r, from_wallet_id: walletId, version: r.version + 1, changed: "wallet" as const }
                          : { ...r, wallet_id: walletId, version: r.version + 1, changed: "wallet" as const }
                        : r
                    )
                  )
                }
                onSetCategory={(categoryId) =>
                  setRows((rs) =>
                    rs.map((r) =>
                      r.id === row.id && r.type !== "transfer"
                        ? { ...r, category_id: categoryId, version: r.version + 1, changed: "category" as const }
                        : r
                    )
                  )
                }
              />
            ))}
          </ul>

          {liveRows.length === 0 && !permissionError && (
            <div className="mt-6 rounded-2xl border border-[var(--ring-subtle)] bg-[var(--surface)] px-[18px] py-6 text-center text-[var(--label-secondary)]">
              <p className="text-[14px] font-medium text-[var(--foreground)]">
                {t("voice.empty.title") || "Speak naturally"}
              </p>
              <p className="mt-1 text-[12px]">
                {t("voice.empty.body") ||
                  "Add multiple transactions, correct one mid-sentence, or say \"delete the last one\". We'll log them when you save."}
              </p>
            </div>
          )}

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-[18px] py-4 text-center text-[13px] text-[var(--foreground)]">
              {permissionError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[var(--ring-subtle)] bg-[var(--background)]/80 px-4 backdrop-blur"
          style={{
            paddingBottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))",
            paddingTop: 8,
          }}
        >
          {/* Caption */}
          <div className="min-h-[22px] text-center" aria-live="polite">
            {thinking ? (
              <span className="text-[11.5px] text-[var(--label-tertiary)]">
                {t("voice.caption.thinking") || "Thinking…"}
              </span>
            ) : utterance ? (
              <span
                key={utterance}
                className="voice-caption inline-block text-[13px] font-medium italic leading-tight text-[var(--label-secondary)]"
              >
                “{utterance}”
              </span>
            ) : (
              <span className="text-[11.5px] text-[var(--label-tertiary)]">{captionFallback}</span>
            )}
          </div>

          {saveError && (
            <div className="mt-1 text-center text-[11px] text-red-500">{saveError}</div>
          )}

          {/* Controls row: Pause | Waveform | Save */}
          <div className="mt-2 flex items-center gap-2.5">
            <button
              onClick={onTogglePause}
              disabled={!!permissionError}
              aria-label={paused ? "Resume listening" : "Pause listening"}
              className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-card)] ring-1 ring-[var(--ring-default)] disabled:opacity-50"
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>

            <div className="min-w-0 flex-1 overflow-hidden">
              <VoiceWaveform volume={volume} listening={!paused && !permissionError} />
            </div>

            <button
              onClick={onSave}
              disabled={liveRows.length === 0 || saving}
              className="inline-flex h-[50px] min-w-[110px] shrink-0 items-center justify-center gap-1.5 rounded-full px-[18px] text-[14.5px] font-semibold transition-all"
              style={{
                background: liveRows.length === 0 || saving ? "rgba(0,0,0,0.06)" : "#EE6452",
                color: liveRows.length === 0 || saving ? "var(--label-tertiary)" : "#fff",
                boxShadow: liveRows.length === 0 || saving ? "none" : "0 8px 24px rgba(238,100,82,0.35)",
              }}
            >
              <CheckIcon />
              {saving
                ? t("common.saving") || "Saving…"
                : `${t("common.save") || "Save"}${liveRows.length ? ` ${liveRows.length}` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 7 4.5Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return ".m4a";
  if (mime.includes("ogg")) return ".ogg";
  return ".webm";
}
