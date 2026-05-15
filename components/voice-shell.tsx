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
import { suggestCategory } from "@/app/actions/ai";
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
  /** v1.42.1 — trimmed list sent to Gemini for parsing. Typically
   *  top-N by recent usage; computed server-side. The full `categories`
   *  is still used for the per-row picker so the user can manually
   *  swap to any category in the household. Falls back to `categories`
   *  when omitted (back-compat). */
  categoriesForGemini?: DbCategory[];
  wallets: DbWallet[];
  currency: string;
  languageHint?: "auto" | "en" | "id" | null;
  /** v1.42.0 — pipe through the user's icon preference so voice rows
   *  match the rest of the app's category iconography. */
  iconStyle?: IconStyle;
};

export default function VoiceShell({
  categories,
  categoriesForGemini,
  wallets,
  currency,
  languageHint = "auto",
  iconStyle = "3d",
}: Props) {
  // Fall back to the full list if the trimmed prop wasn't provided.
  const geminiCats = categoriesForGemini ?? categories;
  const router = useRouter();
  const t = useT();

  const [rows, setRows] = useState<VoiceDraft[]>([]);
  const [paused, setPaused] = useState(false);
  // v1.42.2: removed `utterance` state — we no longer display the
  // live transcript. The waveform + the row landing are the user
  // feedback.
  const [volume, setVolume] = useState(0.05);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // v1.42.1: removed `thinking` flag — waveform is the activity cue.

  // v1.42.1: chip-ladder disambiguation. When a voice update/remove
  // matches 2+ rows by substring, we don't silently pick the latest;
  // we stash the action here and render a small picker that lets the
  // user tap which row they meant. Cleared by either picking one or
  // tapping outside (which cancels the update entirely).
  const [pendingAmbiguous, setPendingAmbiguous] = useState<{
    action: Extract<VoiceAction, { kind: "update" | "remove" }>;
    candidateIds: string[];
  } | null>(null);

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

  // v1.43.0 — per-row inflight categorize cancellation. When the user
  // edits a row's name (voice or manual) we re-run suggestCategory()
  // to get the correct category for the new name. If they edit a
  // second time before the first call returned, we want to cancel
  // the first so the stale answer doesn't race in and overwrite the
  // new one. Map of rowId → AbortController.
  const categorizeAbortRef = useRef<Map<string, AbortController>>(new Map());

  /** Cancel any inflight categorize call for this row. Safe to call
   *  even when nothing is inflight. */
  const cancelCategorize = useCallback((rowId: string) => {
    const ctrl = categorizeAbortRef.current.get(rowId);
    if (ctrl) {
      ctrl.abort();
      categorizeAbortRef.current.delete(rowId);
    }
  }, []);

  /** Fire suggestCategory for a row, cancelling any previous inflight
   *  request for the same row. Marks the row as `category_pending`
   *  while we wait; clears + sparkles when the answer lands. Silent on
   *  abort (which is normal during rapid edits). */
  const runCategorize = useCallback(
    (rowId: string, name: string, type: "income" | "expense") => {
      cancelCategorize(rowId);
      const ctrl = new AbortController();
      categorizeAbortRef.current.set(rowId, ctrl);
      // Flag the row as pending immediately so the icon spins.
      setRows((rs) =>
        rs.map((r) =>
          r.id === rowId && r.type !== "transfer"
            ? { ...r, category_pending: true }
            : r
        )
      );
      void (async () => {
        let resolved: string | null = null;
        try {
          const res = await suggestCategory(name, type);
          if (ctrl.signal.aborted) return;
          if (res.ok) resolved = res.categoryId;
        } catch {
          /* swallow */
        }
        if (ctrl.signal.aborted) return;
        categorizeAbortRef.current.delete(rowId);
        setRows((rs) =>
          rs.map((r) => {
            if (r.id !== rowId || r.type === "transfer") return r;
            // If the user manually picked a category while we were
            // mid-flight, don't overwrite — preserve their choice.
            if (!r.category_pending) return r;
            return {
              ...r,
              category_id: resolved,
              category_pending: false,
              category_ai: resolved !== null,
              version: r.version + 1,
              changed: resolved !== null ? "category" : null,
            };
          })
        );
      })();
    },
    [cancelCategorize]
  );

  // Cancel all pending categorize calls on unmount so we don't get
  // late state writes after the screen has been left.
  useEffect(() => {
    const map = categorizeAbortRef.current;
    return () => {
      for (const ctrl of map.values()) ctrl.abort();
      map.clear();
    };
  }, []);

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
        (r) => !r.exiting && !r.ghost && r.name.toLowerCase().includes(needle)
      );
      return matches.length ? matches[matches.length - 1].id : null;
    }
    return null;
  }, []);

  // v1.42.1: variant that returns ALL matching candidates, used to
  // detect ambiguity. When this returns >1 id we surface the chip
  // ladder instead of silently picking the latest.
  const resolveCandidates = useCallback((target: VoiceTarget): string[] => {
    if (target.mostRecent) {
      return lastAddedIdRef.current ? [lastAddedIdRef.current] : [];
    }
    if (target.name) {
      const needle = target.name.toLowerCase();
      const matches = rowsRef.current.filter(
        (r) => !r.exiting && !r.ghost && r.name.toLowerCase().includes(needle)
      );
      return matches.map((r) => r.id);
    }
    return [];
  }, []);

  // v1.42.2 — applyParsedAction replaces the ghost-row promoter.
  //
  // The flow: an utterance comes in → Whisper → Gemini parse → THIS.
  // No optimistic insert before the parse decision lands.
  //
  //   add      → insert a row with name+amount+type, but category_id=null +
  //              `category_pending: true`. A setTimeout 250ms later fills
  //              in the parsed category and toggles `changed: 'category'`,
  //              which kicks the sparkle animation. This matches the
  //              two-phase appearance the user asked for: "description
  //              and numbers first, then auto-categorisation later."
  //   transfer → append a transfer row (no category for transfers).
  //   update   → patch the target row.
  //   remove   → mark target exiting.
  //   noop     → no-op.
  // v1.43.1 — promote-or-drop the ghost row based on Gemini's parsed
  // action. For `add`, we patch the existing ghost row in place
  // (preserves DOM node → smooth animation, no flicker). For all
  // other action kinds, drop the ghost first then fall through to the
  // normal applyParsedAction.
  const promoteGhostOrDrop = useCallback(
    (ghostId: string, action: VoiceAction) => {
      if (action.kind === "add") {
        // Same row id → React keeps the DOM node mounted, so the row
        // morphs in place (name + amount + type fill in, category
        // icon starts the spinner from the still-coral pulse it had
        // as a ghost).
        lastAddedIdRef.current = ghostId;
        setRows((rs) =>
          rs.map((r) =>
            r.id === ghostId
              ? ({
                  ...r,
                  name: action.tx.name,
                  amount: action.tx.amount,
                  type: action.tx.type,
                  wallet_id: action.tx.wallet_id,
                  ghost: false,
                  category_pending: action.tx.amount > 0,
                  version: r.version + 1,
                  changed: "name",
                } as ParsedTransaction)
              : r
          )
        );
        // Kick off the auto-categorisation for the now-real row.
        // Skip incomplete (amount=0) — runCategorize fires later when
        // the amount stitches in.
        if (action.tx.amount > 0) {
          runCategorize(ghostId, action.tx.name, action.tx.type);
        }
        return;
      }
      // Drop the ghost and route the action through the normal path.
      setRows((rs) => rs.filter((r) => r.id !== ghostId));
      applyParsedAction(action);
    },
    // applyParsedAction + runCategorize are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const applyParsedAction = useCallback(
    (action: VoiceAction) => {
      if (action.kind === "noop") return;

      // v1.42.3 — undo command. Pops the most-recent row immediately.
      // We use the lastAddedIdRef instead of array-tail because a row
      // the user has already swiped-out via "delete the kopi" might
      // still be in the exiting-animation phase.
      if (action.kind === "undo") {
        const lastId = lastAddedIdRef.current;
        if (!lastId) return;
        // v1.43.0 — cancel any inflight categorize for this row so a
        // late answer doesn't write to state after the row is gone.
        cancelCategorize(lastId);
        setRows((rs) => rs.map((r) => (r.id === lastId ? { ...r, exiting: true } : r)));
        setTimeout(() => {
          setRows((rs) => rs.filter((r) => r.id !== lastId));
        }, 280);
        lastAddedIdRef.current = null;
        return;
      }

      if (action.kind === "add") {
        const id = crypto.randomUUID();
        const isIncomplete = action.tx.amount === 0;
        // Phase 1: row appears IMMEDIATELY with name + amount + type.
        // Category-pending only when we have a real amount — an
        // incomplete row (amount=0, waiting for the amount-only
        // follow-up) doesn't burn a categorize call yet.
        const phase1: ParsedTransaction = {
          ...action.tx,
          id,
          category_id: null,
          version: 1,
          changed: null,
          category_pending: !isIncomplete,
          category_ai: false,
        };
        lastAddedIdRef.current = id;
        setRows((rs) => [...rs, phase1]);

        // Skip categorisation for incomplete rows — we'll fire it
        // when the amount-stitch update lands and the name is final.
        if (!isIncomplete) {
          runCategorize(id, action.tx.name, action.tx.type);
        }
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

      // update / remove
      applyActionInternal(action);
    },
    // applyActionInternal is stable via useCallback below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Reducer: apply non-add VoiceActions ─────────────────────────────
  //
  // Handles update + remove. add/transfer are handled in applyParsedAction
  // because they have the two-phase appearance + lastAddedId bookkeeping.
  const applyActionInternal = useCallback(
    (action: VoiceAction) => {
      if (action.kind === "noop") return;
      if (action.kind === "undo") return; // handled by applyParsedAction
      if (action.kind === "add" || action.kind === "transfer") return; // handled by applyParsedAction

      if (action.kind === "update") {
        const targetId = resolveTarget(action.target);
        if (!targetId) return;
        const patch = action.patch;

        // v1.43.0 — Resolve category_name → category_id by fuzzy-matching
        // against the FULL household category list (not the trimmed
        // top-N). Matches are scored:
        //   1. exact case-insensitive name match → highest priority
        //   2. case-insensitive substring (either direction)
        //   3. type-correct match preferred over wrong-type
        // If no match found, the patch silently drops category — the
        // user can still pick manually from the row's picker.
        let resolvedCategoryId: string | null | undefined = patch.category_id;
        if (patch.category_name && resolvedCategoryId === undefined) {
          const targetRow = rowsRef.current.find((r) => r.id === targetId);
          const targetType = targetRow && targetRow.type !== "transfer" ? targetRow.type : null;
          resolvedCategoryId = fuzzyResolveCategory(patch.category_name, categories, targetType);
        }

        // Determine which cell changed for the per-cell pop animation.
        // Priority follows the order Gemini's most likely to emit.
        const changed: VoiceDraft["changed"] =
          patch.amount !== undefined
            ? "amount"
            : resolvedCategoryId !== undefined
              ? "category"
              : patch.wallet_id !== undefined
                ? "wallet"
                : patch.name !== undefined
                  ? "name"
                  : null;

        // Was this row incomplete (amount=0) BEFORE this update?
        // If yes, and the update fills in the amount, we need to fire
        // the deferred categorize call (the add-branch skipped it).
        const targetRow = rowsRef.current.find((r) => r.id === targetId);
        const wasIncomplete =
          targetRow && targetRow.type !== "transfer" && targetRow.amount === 0;
        const stitchingAmount = wasIncomplete && patch.amount !== undefined && patch.amount > 0;

        setRows((rs) =>
          rs.map((r) => {
            if (r.id !== targetId) return r;
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
              ...(resolvedCategoryId !== undefined
                ? {
                    category_id: resolvedCategoryId,
                    category_ai: false, // explicit voice pick — not AI-guessed
                    category_pending: false,
                  }
                : {}),
              ...(patch.wallet_id !== undefined ? { wallet_id: patch.wallet_id } : {}),
              version: r.version + 1,
              changed,
            };
            return nextExp;
          })
        );

        // Cache the narrowed transactional row (TS doesn't carry the
        // earlier `wasIncomplete` narrowing into these later checks).
        const txRow =
          targetRow && targetRow.type !== "transfer" ? targetRow : null;

        // v1.43.0 — when the voice update changed the description, the
        // CURRENT category is now stale (it was suggested for the OLD
        // name). Re-run suggestCategory to refresh it. Cancels any
        // inflight categorise for this row first.
        // Skipped if the user ALSO explicitly set a category in this
        // same update (their voice pick beats the auto-suggest).
        if (
          patch.name !== undefined &&
          resolvedCategoryId === undefined &&
          txRow
        ) {
          runCategorize(targetId, patch.name, txRow.type);
        }
        // Stitching path: incomplete row just got its amount → run
        // the categorize call we deferred when the description landed.
        if (stitchingAmount && txRow) {
          const finalName = patch.name ?? txRow.name;
          runCategorize(targetId, finalName, txRow.type);
        }
        return;
      }

      if (action.kind === "remove") {
        const targetId = resolveTarget(action.target);
        if (!targetId) return;
        cancelCategorize(targetId);
        // Mark exiting so the row plays the exit animation, then
        // remove it from state 280ms later.
        setRows((rs) => rs.map((r) => (r.id === targetId ? { ...r, exiting: true } : r)));
        setTimeout(() => {
          setRows((rs) => rs.filter((r) => r.id !== targetId));
        }, 280);
        return;
      }
    },
    [resolveTarget, cancelCategorize]
  );

  // ── Mic capture lifecycle ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const mic = createMicCapture({
      onVolume: (v) => {
        if (!cancelled) setVolume(v);
      },
      // v1.42.1: onSilenceFlush no longer toggles UI state — the
      // waveform already shows the moving line dying down naturally
      // when the user stops speaking.
      onSilenceFlush: () => {},
      onUtterance: async (blob, meta) => {
        if (cancelled) return;
        // Heavier minimum-size guard kills silent blobs before they
        // reach Whisper (see hallucination notes in v1.42.1).
        if (blob.size < 6000) return;
        if (meta.hadVoice === false) return;

        // v1.42.2: REMOVED the ghost-row optimistic insert. The user
        // found the "draft list of what I said" — a row with the raw
        // transcript text — distracting. Now we keep the screen quiet
        // (just the waveform moving) while Whisper + Gemini work, and
        // the row only appears AFTER Gemini decides. The two-phase
        // appearance (name+amount+type first → category fills in with
        // a sparkle) preserves the "AI is thinking" feel without
        // showing intermediate transcript noise.
        // v1.43.1 — ghost row pattern (re-introduced).
        // The user reported "3 seconds from end-of-speech to row
        // appears" feels slow. The chain is:
        //   silence (1500ms) + Whisper (~150ms) + Gemini parse (~400-900ms)
        // Total: ~2.0-2.5s before anything shows. To make the screen
        // feel responsive at ~1.7s, we now insert a "ghost" row the
        // moment Whisper completes, with a CLEANED placeholder name
        // (number-words stripped from the transcript). The row shows
        // amount=— and a Loader2 in the category slot. When Gemini's
        // parse lands a few hundred ms later, the existing patch path
        // updates the row in place with the real name + amount + type.
        const ghostId = crypto.randomUUID();
        let ghostInserted = false;
        try {
          const fd = new FormData();
          fd.set("audio", blob, "utterance" + extFor(meta.mime));
          if (languageHint && languageHint !== "auto") fd.set("language_hint", languageHint);
          const transcribed = await transcribeVoiceAudio(fd);
          if (cancelled) return;
          if (!transcribed.ok) {
            setSaveError(transcribed.error);
            return;
          }
          const text = transcribed.text.trim();
          if (!text) return;
          if (isWhisperHallucination(text)) return;

          // Phase A: ghost row appears NOW with cleaned description.
          // We don't yet know if this is add / update / remove etc., so
          // we render it as an incomplete "add" — same visual style as
          // a real amount=0 row (— in the amount slot). When Gemini
          // returns:
          //   - add        → patch ghost into real row (in place)
          //   - update     → drop ghost, route action to target row
          //   - remove     → drop ghost, mark target exiting
          //   - transfer   → drop ghost, append a transfer row
          //   - undo / noop → drop ghost silently
          // Skipped for very short transcripts (likely a stub word
          // like "satu" or "ya" — no point flashing a ghost).
          const placeholderName = cleanTranscriptForPlaceholder(text);
          if (placeholderName.length >= 2) {
            ghostInserted = true;
            const ghost: ParsedTransaction = {
              id: ghostId,
              name: placeholderName,
              amount: 0,
              type: "expense",
              category_id: null,
              wallet_id: null,
              version: 1,
              changed: null,
              ghost: true,
            };
            setRows((rs) => [...rs, ghost]);
          }

          // Phase B: parse — context built fresh from rowsRef so Gemini
          // sees the latest names + which rows are incomplete. Strip
          // the ghost we just inserted from the context so Gemini
          // doesn't try to "update the kue" referring to itself.
          const parsed = await parseVoiceUtterance(text, {
            categories: geminiCats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            wallets: wallets.map((w) => ({ id: w.id, name: w.name })),
            rows: rowsRef.current
              .filter((r) => !r.exiting && !r.ghost)
              .map((r) => ({
                id: r.id,
                name: r.name,
                incomplete: r.type !== "transfer" && r.amount === 0,
              })),
            defaultWalletId: wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? null,
          });
          if (cancelled) return;
          if (!parsed.ok) {
            if (ghostInserted) setRows((rs) => rs.filter((r) => r.id !== ghostId));
            setSaveError(parsed.error);
            return;
          }
          // Ambiguity check for update/remove — handled BEFORE the
          // ghost-promotion logic because we drop the ghost in that
          // branch too.
          if (parsed.action.kind === "update" || parsed.action.kind === "remove") {
            const cands = resolveCandidates(parsed.action.target);
            if (cands.length > 1) {
              if (ghostInserted) setRows((rs) => rs.filter((r) => r.id !== ghostId));
              setPendingAmbiguous({ action: parsed.action, candidateIds: cands });
              return;
            }
          }

          // Promote the ghost based on the parsed action.
          if (ghostInserted) {
            promoteGhostOrDrop(ghostId, parsed.action);
          } else {
            applyParsedAction(parsed.action);
          }
        } catch (err) {
          if (cancelled) return;
          if (ghostInserted) setRows((rs) => rs.filter((r) => r.id !== ghostId));
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

  // v1.42.1: user picked one of the ambiguous candidates. We patch
  // the pending action's target to point UNAMBIGUOUSLY at the chosen
  // row (by injecting a `name` that uniquely matches it — its own
  // name truncated to first 24 chars is safe because we know that
  // string came from a real row in the list).
  function pickAmbiguous(rowId: string) {
    if (!pendingAmbiguous) return;
    const row = rowsRef.current.find((r) => r.id === rowId);
    if (!row) {
      setPendingAmbiguous(null);
      return;
    }
    const { action } = pendingAmbiguous;
    // Use the row's exact name as the target.name so resolveTarget
    // resolves to a single row (well, possibly still multiple if two
    // rows have identical names — in which case we pick the latest
    // which is the same outcome). Easier than wiring an id-target.
    const targetedAction: VoiceAction =
      action.kind === "update"
        ? { ...action, target: { name: row.name, mostRecent: false } }
        : { ...action, target: { name: row.name, mostRecent: false } };
    // Temporarily nudge lastAddedIdRef so resolveTarget(mostRecent:true)
    // would return the picked id even if Gemini used mostRecent. We
    // don't use that path here, but it's defensive.
    setPendingAmbiguous(null);
    applyActionInternal(targetedAction);
  }
  function cancelAmbiguous() {
    setPendingAmbiguous(null);
  }

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
  // v1.43.0: incomplete rows (amount=0, waiting for stitch) likewise
  // excluded from save. They stay visible in the UI so the user knows
  // they need to follow up with a number, but Save skips them.
  const liveRows = useMemo(
    () => rows.filter((r) => !r.exiting && !r.ghost && r.amount > 0),
    [rows]
  );
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

      // ── Magical save phase. v1.43.1 — three changes from v1.42.x:
      //   1. Fly-out glow is now emerald (success), not coral.
      //   2. We kick off `router.refresh()` IMMEDIATELY when the save
      //      resolves, so Next starts re-fetching the /transactions
      //      SSR data IN PARALLEL with the fly-out animation playing.
      //      By the time we navigate at the end of the animation, the
      //      home screen's new data is usually warm — no white-screen
      //      blink, the saved rows just appear with their own row-in +
      //      tx-flash animation on the top one.
      //   3. We also `prefetch` /transactions to warm the route shell.
      router.prefetch("/transactions");
      // Start the refresh now (async). The actual route change waits
      // for the fly-out to finish.
      void Promise.resolve().then(() => router.refresh());

      setFlying(true);
      const STAGGER_MS = 50;
      const FLY_DURATION_MS = 620;
      const totalMs = STAGGER_MS * liveRows.length + FLY_DURATION_MS;
      await new Promise((r) => setTimeout(r, Math.min(totalMs, 1100)));

      router.push("/transactions");
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
                        ? {
                            ...r,
                            category_id: categoryId,
                            // v1.42.2: a manual pick is no longer AI-picked.
                            // Mirrors how the typed Add Transaction sheet
                            // clears the sparkle once you override.
                            category_ai: false,
                            category_pending: false,
                            version: r.version + 1,
                            changed: "category" as const,
                          }
                        : r
                    )
                  )
                }
              />
            ))}
          </ul>

          {/* v1.42.1: empty-state card removed. The footer caption
              ("Try: \"Bensin tiga ratus ribu\"") already covers the
              same guidance with one line instead of a whole card. */}

          {permissionError && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-[18px] py-4 text-center text-[13px] text-[var(--foreground)]">
              {permissionError}
            </div>
          )}
        </div>

        {/* v1.42.1 — Ambiguous-target chip ladder.
            Fires when a voice update/remove matches 2+ rows. We pause
            the visual flow (caption shows what the user said), list the
            candidates as chips, and let the user tap which one they
            meant. Outside-tap cancels the whole action. */}
        {pendingAmbiguous && (
          <div
            className="absolute inset-x-3 z-[80] flex flex-col gap-2 rounded-2xl border border-[var(--ring-default)] bg-[var(--surface)] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
            style={{ bottom: 130 }}
            role="dialog"
            aria-label="Which one did you mean?"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[var(--foreground)]">
                Which one did you mean?
              </p>
              <button
                onClick={cancelAmbiguous}
                aria-label="Cancel"
                className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--label-tertiary)] active:scale-95"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pendingAmbiguous.candidateIds.map((rid) => {
                const r = rows.find((x) => x.id === rid);
                if (!r) return null;
                return (
                  <button
                    key={rid}
                    onClick={() => pickAmbiguous(rid)}
                    className="rounded-full bg-[var(--background)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] ring-1 ring-[var(--ring-default)] active:scale-95"
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[var(--ring-subtle)] bg-[var(--background)]/80 px-4 backdrop-blur"
          style={{
            paddingBottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))",
            paddingTop: 8,
          }}
        >
          {/* Caption — v1.42.2: removed the "you said X" live transcript
              display. User asked that nothing intermediate appear before
              Gemini's decision lands; the waveform shows activity and the
              row landing IS the feedback. Only the fallback hint
              ("Try: \"Bensin tiga ratus ribu\"" / "Paused…") stays. */}
          <div className="min-h-[22px] text-center" aria-live="polite">
            <span className="text-[11.5px] text-[var(--label-tertiary)]">{captionFallback}</span>
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

// v1.43.0 — fuzzy category-name resolver.
//
// Voice says "transport" or "food and drinks" or "kategori transport".
// We map that string to an actual category id from the household list.
// Scoring:
//   1. Exact case-insensitive name match (best)
//   2. Substring match (either direction)
//   3. Type-correct match preferred over wrong type
//
// Returns null when nothing reasonable matches — caller should silently
// drop the category from the patch in that case (the user can still
// open the picker and choose manually).
function fuzzyResolveCategory(
  spoken: string,
  categories: DbCategory[],
  preferType: "income" | "expense" | null
): string | null {
  if (!spoken || categories.length === 0) return null;
  const needle = spoken
    .toLowerCase()
    .replace(/\b(kategori|category|ke|to|menjadi|jadi|into|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!needle) return null;

  type Cand = { id: string; score: number; rightType: boolean };
  const cands: Cand[] = [];
  for (const c of categories) {
    const cname = c.name.toLowerCase();
    let score = 0;
    if (cname === needle) score = 100;
    else if (cname.includes(needle) || needle.includes(cname)) {
      // longer overlap = better
      const overlap = Math.min(cname.length, needle.length);
      score = 40 + overlap;
    } else {
      // word-level intersection — "food and drinks" vs "food & drink"
      const a = new Set(cname.split(/\s+/));
      const b = new Set(needle.split(/\s+/));
      let inter = 0;
      for (const tok of b) if (a.has(tok)) inter += 1;
      if (inter > 0) score = inter * 10;
    }
    if (score === 0) continue;
    cands.push({ id: c.id, score, rightType: preferType ? c.type === preferType : true });
  }
  if (cands.length === 0) return null;
  cands.sort((a, b) => {
    // Wrong-type penalty: a right-type match always beats wrong-type
    // unless the wrong-type score is dramatically higher (rarely useful).
    if (a.rightType !== b.rightType) return a.rightType ? -1 : 1;
    return b.score - a.score;
  });
  return cands[0].id;
}

// v1.43.1 — strip number-words from the Whisper transcript so the
// ghost row's placeholder name shows just the description, not the
// number tail. Approximate but cheap; the real cleanup happens when
// Gemini parses and the ghost is patched in place.
//
// Stripped tokens:
//   • bare digits, comma, period
//   • Indonesian number words: satu/dua/.../sembilan, sepuluh, ratus,
//     ribu, juta, miliar, milyar, sebelas, belas
//   • English number words: thousand, million, billion, hundred, k
//   • currency markers: rp, idr, rupiah, dollars, usd
//
// "Nasi goreng dua puluh lima ribu" → "Nasi goreng"
// "Kopi 25rb"                       → "Kopi"
// "Beli kue"                        → "Beli kue" (no numbers, untouched)
const NUMBER_WORD_RE = new RegExp(
  "\\b(" +
    "satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|belas|puluh|ratus|ribu|juta|miliar|milyar|" +
    "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|k|rb|" +
    "rp|idr|rupiah|dollars?|usd" +
  ")\\b",
  "gi"
);

function cleanTranscriptForPlaceholder(raw: string): string {
  const out = raw
    .replace(/[\d.,]+/g, " ")       // drop bare numbers and grouping
    .replace(NUMBER_WORD_RE, " ")    // drop number-words
    .replace(/\s+/g, " ")
    .trim();
  // Capitalise first letter to match the ucFirst normalisation in the
  // server parse. Tiny touch but reads consistently with later phases.
  if (!out) return "";
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return ".m4a";
  if (mime.includes("ogg")) return ".ogg";
  return ".webm";
}

// v1.42.1 — known Whisper-large-v3 hallucinations.
//
// Whisper's training set includes a LOT of YouTube videos and the
// model has learned to emit common outros / boilerplate when fed
// silent or near-silent audio. The mic-layer voice-gate now stops
// most of these from ever being shipped, but a quiet utterance that
// rides just barely above the VOICE_RMS threshold can still trigger
// the model. This filter catches the residue.
//
// If you see a new false-positive in production, just add the
// (lowercased, punctuation-stripped) phrase here. We compare against
// the cleaned transcript — short transcripts that ARE a hallucination
// pattern get dropped; longer transcripts that merely CONTAIN one as
// a substring are not (the user genuinely saying "transfer dari BCA
// terima kasih" should still parse).
const WHISPER_HALLUCINATIONS = new Set<string>([
  // Indonesian YouTube outros
  "terima kasih",
  "terima kasih sudah menonton",
  "terima kasih telah menonton",
  "terima kasih banyak",
  // English YouTube outros
  "thanks for watching",
  "thank you for watching",
  "subscribe to my channel",
  "please subscribe",
  "like and subscribe",
  // Music / silence markers Whisper sometimes emits literally
  "♪",
  "[music]",
  "[silence]",
  "(silence)",
  "you",
  ".",
]);

function isWhisperHallucination(rawText: string): boolean {
  const cleaned = rawText
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return true;
  // Exact-match against the hallucination dictionary.
  if (WHISPER_HALLUCINATIONS.has(cleaned)) return true;
  // Also drop transcripts that are JUST a hallucination phrase plus
  // trailing punctuation noise. We compare token-wise so genuinely
  // long utterances ("transfer dari BCA terima kasih") survive.
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length <= 5) {
    const joined = tokens.join(" ");
    if (WHISPER_HALLUCINATIONS.has(joined)) return true;
  }
  return false;
}
