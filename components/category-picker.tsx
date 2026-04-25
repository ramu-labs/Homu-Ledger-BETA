"use client";

import { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import AddCategorySheet from "@/components/add-category-sheet";
import { cn } from "@/lib/cn";
import type { DbCategory } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  categories: DbCategory[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onCategoryAdded: (cat: DbCategory) => void;
  iconStyle?: IconStyle;
};

export default function CategoryPicker({
  categories,
  selected,
  onSelect,
  onClose,
  onCategoryAdded,
  iconStyle = "3d",
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [localCategories, setLocalCategories] = useState<DbCategory[]>(categories);

  function handleAdded(cat: DbCategory) {
    setLocalCategories((prev) => [...prev, cat]);
    onCategoryAdded(cat);
    setShowAdd(false);
    // Auto-select the newly added category
    onSelect(cat.id);
    onClose();
  }

  const allCategories = localCategories;

  return (
    <>
      {/* Dim overlay — closes picker */}
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />

      {/* Half-screen bottom sheet (~65% height) */}
      <div className="fixed bottom-0 left-1/2 z-[90] flex w-full max-w-md -translate-x-1/2 flex-col rounded-t-3xl bg-[var(--surface)]" style={{ maxHeight: "65dvh" }}>
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
          <h3 className="text-[17px] font-semibold text-[var(--foreground)]">Category</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {allCategories.length === 0 ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-[14px] text-[var(--label-secondary)]">No categories yet. Add one below.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {allCategories.map((cat) => {
                const isSelected = selected === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { onSelect(isSelected ? null : cat.id); onClose(); }}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 transition-all active:scale-[0.97]",
                      isSelected
                        ? "ring-2 ring-[var(--foreground)]/30"
                        : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                    )}
                    style={isSelected ? { backgroundColor: `${cat.color}22` } : undefined}
                  >
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)]">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <CategoryIcon
                        symbol={cat.symbol}
                        iconStyle={iconStyle}
                        size={26}
                        emojiSize="26px"
                        color={iconStyle === "2d" ? cat.color : undefined}
                      />
                    </span>
                    <span className="text-center text-[13px] font-medium leading-snug text-[var(--foreground)]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky footer — Add new category button */}
        <div className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pb-8 pt-3">
          <button
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3.5 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Add new category
          </button>
        </div>
      </div>

      {/* Add Category sheet — opens on top of the picker (z-[100]+) */}
      <AddCategorySheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={handleAdded}
        iconStyle={iconStyle}
      />
    </>
  );
}
