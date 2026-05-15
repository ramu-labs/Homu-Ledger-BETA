// Shared types for the AI Voice Transactions feature (v1.41.0).
//
// The voice screen holds a list of `ParsedTransaction` rows — each one
// representing a single transaction the user dictated. They live in
// client-only state until the user taps Save, at which point they're
// fanned out through the existing queuedAddTransaction pipeline.
//
// `VoiceAction` is the shape Gemini returns after parsing one
// utterance: it's a discriminated union that tells the client what to
// do to the row list (append, patch an existing row, remove one,
// create a transfer pair, or no-op for off-topic speech).

/** A row in the voice-screen draft list. NOT a DB row — these are
 *  client-side only until the user taps Save. */
export type ParsedTransaction = {
  /** Local-only id (uuid-ish). Becomes the client_op_id on save. */
  id: string;
  /** Description shown on the row + saved as `name` on the DB row. */
  name: string;
  /** Positive integer in minor units of the household currency. */
  amount: number;
  /** Same enum as the DB. Transfers are a separate `ParsedTransfer`. */
  type: "expense" | "income";
  /** Optional — falls back to "Uncategorized" if null. */
  category_id: string | null;
  /** Optional — falls back to the household's default wallet if null. */
  wallet_id: string | null;
  /** Bumps every time the row is mutated. Drives the edit-pulse
   *  animation in voice-row.tsx via a `useEffect([version])` watcher. */
  version: number;
  /** Which field just changed — used to pop the right cell. Null on
   *  first mount (a brand-new row uses the enter animation instead). */
  changed: "amount" | "category" | "wallet" | "name" | null;
  /** True from the moment "remove" lands until the exit animation
   *  finishes (260ms). Filtered out of the save batch. */
  exiting?: boolean;
  /** v1.42.0 — true while Whisper has returned a transcript but
   *  Gemini parse hasn't completed yet. Renders as a skeleton row
   *  with the raw transcript as a placeholder; filtered out of the
   *  save batch. Replaced in-place when parse completes.
   *  v1.42.2: ghost-row pattern removed from the shell entirely;
   *  field kept for backwards-compat with the type union but never
   *  set anymore. Safe to drop in a follow-up cleanup pass. */
  ghost?: boolean;
  /** v1.42.2 — true between row-mount and the moment the auto-
   *  categoriser fills in. Voice row renders the category icon slot
   *  as a Loader2 spinner during this window; flips to false once
   *  the category arrives, triggering the sparkle finish animation. */
  category_pending?: boolean;
  /** v1.42.2 — true when the category was AI-picked (parse or cache
   *  hint), false after the user manually overrides. Drives the
   *  small Sparkles indicator next to the row's category icon, same
   *  signal the typed Add Transaction sheet shows for AI picks. */
  category_ai?: boolean;
};

/** A transfer row — visually distinct (coral arrow icon), saves via
 *  addTransfer rather than addTransaction. */
export type ParsedTransfer = {
  id: string;
  name: string;
  amount: number;
  type: "transfer";
  from_wallet_id: string;
  to_wallet_id: string;
  version: number;
  changed: "amount" | "wallet" | "name" | null;
  exiting?: boolean;
  ghost?: boolean;
};

/** Union of all drafts the voice screen can hold. */
export type VoiceDraft = ParsedTransaction | ParsedTransfer;

// ── What Gemini returns after parsing one utterance ─────────────────
//
// Discriminated by `kind`. The client reducer applies these to the
// draft list. `target` is how Gemini refers to an existing row when
// the user says "the kopi" or "the last one" — the client resolves it
// to a real `id` before dispatching.

export type VoiceActionAdd = {
  kind: "add";
  tx: Omit<ParsedTransaction, "id" | "version" | "changed">;
};
export type VoiceActionTransfer = {
  kind: "transfer";
  tx: Omit<ParsedTransfer, "id" | "version" | "changed" | "type">;
};
export type VoiceActionUpdate = {
  kind: "update";
  target: VoiceTarget;
  patch: Partial<{
    amount: number;
    category_id: string | null;
    wallet_id: string | null;
    name: string;
  }>;
};
export type VoiceActionRemove = { kind: "remove"; target: VoiceTarget };
/** v1.42.3 — user said "undo" / "batalkan" / "cancel the last".
 *  Client pops the most recent row regardless of name. No payload
 *  needed; the client uses its own lastAddedIdRef. */
export type VoiceActionUndo = { kind: "undo" };
export type VoiceActionNoop = { kind: "noop" };

export type VoiceAction =
  | VoiceActionAdd
  | VoiceActionTransfer
  | VoiceActionUpdate
  | VoiceActionRemove
  | VoiceActionUndo
  | VoiceActionNoop;

export type VoiceTarget = {
  /** Case-insensitive substring match on the row's `name`. */
  name?: string | null;
  /** True → the row most recently added wins. Trumps `name`. */
  mostRecent?: boolean;
};

// ── Context passed to the NLU call ──────────────────────────────────
//
// Trimmed-down view of the household so the prompt stays small. We
// only need the human-meaningful fields for Gemini to pick a match.

export type VoiceCategoryLite = {
  id: string;
  name: string;
  type: "expense" | "income";
};
export type VoiceWalletLite = {
  id: string;
  name: string;
};
export type VoiceContext = {
  categories: VoiceCategoryLite[];
  wallets: VoiceWalletLite[];
  /** The current draft list — Gemini uses this to resolve "the kopi"
   *  vs "the bensin" references. Only the name + id are needed. */
  rows: Array<{ id: string; name: string }>;
  /** Default wallet id — used as fallback when Gemini returns null. */
  defaultWalletId: string | null;
};
