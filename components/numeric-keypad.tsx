"use client";

// Custom in-app numeric keypad for the Add Transaction amount field.
//
// WHY a custom keypad instead of the iOS numeric keyboard:
// iOS draws a "form accessory bar" (the ‹ › Done strip) above the
// system keyboard for EVERY native editable element — <input>,
// <textarea>, and contenteditable alike. There is no web API to
// remove it; it's WKWebView system chrome. The only way to a clean
// numeric entry with no bar is to not summon the native keyboard at
// all. So the amount field is a plain focusable div (no keyboard)
// and this component is the keypad.
//
// Layout mirrors the iOS number pad: 1-9 in a 3×3 grid, then a final
// row with 0 centred and a backspace key.

import { Delete } from "lucide-react";

type Props = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
};

export default function NumericKeypad({ onDigit, onBackspace }: Props) {
  return (
    <div
      className="grid shrink-0 grid-cols-3 gap-2 bg-[var(--surface)] px-3 pt-2"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
        <KeypadKey key={k} onPress={() => onDigit(k)} label={k}>
          {k}
        </KeypadKey>
      ))}
      {/* Bottom row: empty · 0 · backspace */}
      <span aria-hidden />
      <KeypadKey onPress={() => onDigit("0")} label="0">
        0
      </KeypadKey>
      <KeypadKey onPress={onBackspace} label="Backspace">
        <Delete className="h-[22px] w-[22px]" strokeWidth={2} />
      </KeypadKey>
    </div>
  );
}

function KeypadKey({
  children,
  onPress,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      // preventDefault on mousedown so tapping a key doesn't blur the
      // amount field — the caret + focused state stay intact.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className="flex h-[52px] items-center justify-center rounded-2xl bg-[var(--background)] text-[23px] font-semibold text-[var(--foreground)] ring-1 ring-black/[0.05] transition-colors active:bg-black/[0.07] [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
    >
      {children}
    </button>
  );
}
