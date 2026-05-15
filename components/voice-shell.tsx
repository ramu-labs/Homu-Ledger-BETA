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
import VoiceAurora from "@/components/voice-aurora";
import VoiceWaveform from "@/components/voice-waveform";
import VoiceRow from "@/components/voice-row";
import { transcribeVoiceAudio, parseVoiceUtterance } from "@/app/actions/voice";
import { queuedAddTransaction } from "@/lib/queue-actions";
import { addTransfer } from "@/app/actions/transactions";
import { createMicCapture, type MicCaptureHandle } from "@/lib/voice/mic-capture";
import { useT } from "@/lib/i18n/provider";
import type { DbCategory, DbWallet } from "@/lib/types";
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
};

export default function VoiceShell({ categories, wallets, currency, languageHint = "auto" }: Props) {
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

  // ── Reducer: apply a VoiceAction to the rows list ───────────────────
  const applyAction = useCallback(
    (action: VoiceAction) => {
      if (action.kind === "noop") return;

      if (action.kind === "add") {
        const id = crypto.randomUUID();
        const next: ParsedTransaction = {
          ...action.tx,
          id,
          version: 1,
          changed: null,
        };
        lastAddedIdRef.current = id;
        setRows((rs) => [...rs, next]);
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
        setRows((rs) => [...rs, next]);
        return;
      }

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
          // Build the context FRESH each parse — Gemini uses the
          // current draft rows to resolve "the kopi" references.
          // rowsRef is updated by the [rows]-deps effect above, so it
          // always reflects the latest list.
          const parsed = await parseVoiceUtterance(text, {
            categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            wallets: wallets.map((w) => ({ id: w.id, name: w.name })),
            rows: rowsRef.current
              .filter((r) => !r.exiting)
              .map((r) => ({ id: r.id, name: r.name })),
            defaultWalletId: wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? null,
          });
          if (cancelled) return;
          setThinking(false);
          if (!parsed.ok) {
            setSaveError(parsed.error);
            return;
          }
          applyAction(parsed.action);
          // Clear the caption shortly after — keeps the screen calm.
          setTimeout(() => {
            if (!cancelled) setUtterance(null);
          }, 1500);
        } catch (err) {
          if (cancelled) return;
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

  function onClose() {
    router.back();
  }

  const liveRows = useMemo(() => rows.filter((r) => !r.exiting), [rows]);

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
      // Done — navigate back and refresh the list.
      router.push("/transactions");
      router.refresh();
    } catch (err) {
      setSaveError((err as Error).message ?? "Couldn't save");
      setSaving(false);
      micRef.current?.resume();
    }
  }

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
            aria-label={t("common.close") || "Close"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] transition-transform active:scale-95"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            {t("voice.title") || "Speak to add"}
          </h2>
          <div className="h-9 w-9" aria-hidden />
        </div>

        {/* Scrollable list — packs from the top */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[14px] pb-3 pt-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map((row) => (
              <VoiceRow
                key={row.id}
                row={row}
                categories={categories}
                wallets={wallets}
                currency={currency}
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
