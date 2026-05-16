"use client";

// Category picker — v1.44.0 floating-bento redesign.
//
// Ported from the Add Transaction prototype (`src/tx/add-tx-sheet.jsx`
// → ATxCategoryPicker). Visual changes from the old 4-col bottom sheet:
//   • Floats as a "bento" card: 10px side margin, 18px bottom margin,
//     28px radius, soft shadow — doesn't span edge-to-edge.
//   • 2-col grid, icon-LEFT layout (28px circle + name + check).
//   • Active item = 1.5px coloured border, no background fill.
//   • Slides up translateY(110%)→0 with a double-RAF enter so the
//     transition never gets batched away into an instant pop.
//
// Coordinated-exit: the picker exposes `onCloseStart` — fired the
// instant the user taps the backdrop / an item / the X — so the parent
// AddTransactionSheet can begin sliding back up at the SAME moment the
// bento starts sliding down. `onClose` fires 280ms later to unmount.
// When `onCloseStart` is omitted (e.g. AddRecurringSheet) the picker
// just animates itself; nothing else moves.
//
// Inline-add is preserved: the footer "Add new category" button still
// opens AddCategorySheet.

import { useState, useEffect } from "react";
import { X, Plus, Check } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import AddCategorySheet from "@/components/add-category-sheet";
import { useT } from "@/lib/i18n/provider";
import type { DbCategory, TransactionType } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  categories: DbCategory[];
  selected: string | null;
  type: TransactionType;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onCategoryAdded: (cat: DbCategory) => void;
  iconStyle?: IconStyle;
  /** v1.44.0 — fired synchronously when the picker starts its exit
   *  animation, BEFORE onClose. Lets the parent sheet rise back up in
   *  sync with the bento sliding down. Optional. */
  onCloseStart?: () => void;
};

export default function CategoryPicker({
  categories,
  selected,
  type,
  onSelect,
  onClose,
  onCategoryAdded,
  iconStyle = "3d",
  onCloseStart,
}: Props) {
  const tr = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [localCategories, setLocalCategories] = useState<DbCategory[]>(categories);
  const visibleCategories = localCategories.filter((c) => c.type === type);

  // Double-RAF enter: render at translateY(110%) first, paint, THEN
  // flip visible=true so the transition has a previous state.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let r2: number | null = null;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
  }, []);

  function startClose() {
    setVisible(false);
    onCloseStart?.();
    setTimeout(onClose, 560);
  }

  function handleAdded(cat: DbCategory) {
    setLocalCategories((prev) => [...prev, cat]);
    onCategoryAdded(cat);
    setShowAdd(false);
    onSelect(cat.id);
    startClose();
  }

  return (
    <>
      {/* Backdrop — dim + blur, both animate together. 280ms in,
          140ms out (snappier return). */}
      <div
        onClick={startClose}
        className="fixed inset-0 z-[80] flex items-end justify-center"
        style={{
          background: visible ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
          backdropFilter: visible ? "blur(2px)" : "blur(0px)",
          WebkitBackdropFilter: visible ? "blur(2px)" : "blur(0px)",
          transition: visible
            ? "background 560ms ease, backdrop-filter 560ms ease"
            : "background 280ms ease, backdrop-filter 280ms ease",
          padding: "0 10px 18px",
        }}
      >
        {/* Bento card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-md flex-col bg-[var(--surface)] text-[var(--foreground)]"
          style={{
            maxHeight: "88%",
            borderRadius: 28,
            padding: "10px 0 16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            transform: visible ? "translateY(0)" : "translateY(110%)",
            transition: "transform 560ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="h-1 w-9 rounded-full bg-black/[0.16]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-[18px] pb-2.5 pt-1">
            <span className="text-[15px] font-bold text-[var(--foreground)]">
              {tr("tx.selectCategory")}
            </span>
            <button
              onClick={startClose}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
              aria-label={tr("common.close")}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          {/* 2-col icon-left grid */}
          <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto px-3">
            {visibleCategories.length === 0 ? (
              <p className="col-span-2 py-8 text-center text-[14px] text-[var(--label-secondary)]">
                No {type} categories yet. Add one below.
              </p>
            ) : (
              visibleCategories.map((cat) => {
                const active = cat.id === selected;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelect(active ? null : cat.id);
                      startClose();
                    }}
                    className="flex min-w-0 items-center gap-2.5 rounded-[20px] bg-[var(--background)] px-3 py-[11px] text-left transition-transform active:scale-[0.97]"
                    style={{
                      border: active
                        ? `1.5px solid ${cat.color}`
                        : "1px solid var(--separator)",
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${cat.color}26` }}
                    >
                      <CategoryIcon
                        symbol={cat.symbol}
                        iconStyle={iconStyle}
                        size={16}
                        emojiSize="14px"
                        color={iconStyle === "2d" ? cat.color : undefined}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                      {cat.name}
                    </span>
                    {active && (
                      <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} style={{ color: cat.color }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer — inline add */}
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--background)] py-3 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Add new category
            </button>
          </div>
        </div>
      </div>

      {/* Inline-add — sits above the picker (z-100/110) */}
      <AddCategorySheet
        open={showAdd}
        type={type}
        onClose={() => setShowAdd(false)}
        onAdded={handleAdded}
        iconStyle={iconStyle}
      />
    </>
  );
}
