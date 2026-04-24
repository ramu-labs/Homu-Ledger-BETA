"use client";

import { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { addCategory } from "@/app/actions/categories";
import { cn } from "@/lib/cn";
import type { DbCategory } from "@/lib/types";
import { CategoryIcon } from "@/components/category-icon";

type Props = {
  categories: DbCategory[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onCategoryAdded: (cat: DbCategory) => void;
};

export default function CategoryPicker({
  categories,
  selected,
  onSelect,
  onClose,
  onCategoryAdded,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [iconMode, setIconMode] = useState<"emoji" | "custom">("emoji");
  const [symbol, setSymbol] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FCA5A5");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const SOFT_PALETTE = [
    "#FCA5A5", "#FCD34D", "#6EE7B7", "#93C5FD",
    "#C4B5FD", "#F9A8D4", "#FED7AA", "#A7F3D0", "#D1D5DB",
  ];

  const SYMBOLS = [
    "🏠","🚗","🛒","🍽️","☕","🎬","✈️","💊","📚",
    "👗","💪","🐾","🎁","💡","🔧","📱","💰","🎮",
    "🌿","🏋️","🎵","🧴","🏥","🚌","🧹","💳","🌐",
  ];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (iconMode === "emoji" && !selectedSymbol) {
      setAddError("Pick a symbol");
      return;
    }
    setAdding(true);
    const fd = new FormData();
    fd.set("symbol", iconMode === "custom" ? symbol : selectedSymbol);
    fd.set("name", name);
    if (iconMode === "emoji") {
      fd.set("color", selectedColor);
    } else {
      fd.set("color_index", String(categories.length));
    }
    const result = await addCategory(fd);
    if (result.error) {
      setAddError(result.error);
      setAdding(false);
    } else if (result.category) {
      onCategoryAdded(result.category);
      setSymbol("");
      setSelectedSymbol("");
      setName("");
      setShowAdd(false);
      setAdding(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />

      {/* Full-screen bottom sheet */}
      <div className="fixed bottom-0 left-1/2 z-[90] flex h-dvh w-full max-w-md -translate-x-1/2 flex-col rounded-t-3xl bg-[var(--surface)]">
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-1">
          <h3 className="text-[17px] font-semibold text-[var(--foreground)]">Category</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {categories.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[14px] text-[var(--label-secondary)]">No categories yet. Add one below.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => {
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
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <CategoryIcon symbol={cat.symbol} size={24} emojiSize="26px" />
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

        {/* Sticky footer — Add category */}
        <div className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pb-8 pt-4">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3.5 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Add new category
            </button>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              <p className="text-[13px] font-medium text-[var(--label-secondary)]">New category</p>

              {/* Mode toggle */}
              <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
                {(["emoji", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setIconMode(m)}
                    className={cn(
                      "flex-1 rounded-full py-1 text-[12px] font-medium transition-all min-h-[28px]",
                      iconMode === m
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--label-secondary)]"
                    )}
                  >
                    {m === "emoji" ? "Emoji" : "Custom"}
                  </button>
                ))}
              </div>

              {iconMode === "custom" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="😀"
                    maxLength={4}
                    required
                    autoFocus
                    className="h-12 w-14 shrink-0 rounded-xl bg-[var(--background)] text-center text-[22px] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Category name"
                    required
                    className="h-12 flex-1 rounded-xl bg-[var(--background)] px-3 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Category name"
                    required
                    autoFocus
                    className="h-12 w-full rounded-xl bg-[var(--background)] px-3 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20"
                  />
                  {/* Symbol grid */}
                  <div className="grid grid-cols-9 gap-1.5">
                    {SYMBOLS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSymbol(s)}
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-lg text-[18px] transition-all",
                          selectedSymbol === s
                            ? "ring-2 ring-[var(--foreground)]/40 scale-110"
                            : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                        )}
                        style={selectedSymbol === s ? { backgroundColor: `${selectedColor}33` } : undefined}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {/* Color palette */}
                  <div className="flex gap-2 pt-1">
                    {SOFT_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={cn(
                          "flex-1 rounded-full transition-all",
                          selectedColor === c ? "ring-2 ring-offset-1 ring-[var(--foreground)]/30 scale-110" : ""
                        )}
                        style={{ backgroundColor: c, height: 24 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {addError && <p className="text-[12px] text-rose-600">{addError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError(null); }}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--background)] text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--foreground)] text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
                >
                  {adding ? "Adding…" : "Add Category"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
