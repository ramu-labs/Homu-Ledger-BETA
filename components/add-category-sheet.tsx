"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { addCategory } from "@/app/actions/categories";
import { cn } from "@/lib/cn";
import type { DbCategory } from "@/lib/types";
import { CATEGORY_LUCIDE_ICONS, makeLucideSymbol } from "@/lib/category-icons";
import { CategoryIcon } from "@/components/category-icon";

const SOFT_PALETTE = [
  "#f97316", "#3b82f6", "#8b5cf6", "#ef4444",
  "#ec4899", "#eab308", "#14b8a6", "#22c55e", "#6b7280",
];

const DEFAULT_ICON_ID = CATEGORY_LUCIDE_ICONS[0].id;

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (cat: DbCategory) => void;
};

type IconMode = "icon" | "emoji";

export default function AddCategorySheet({ open, onClose, onAdded }: Props) {
  const [name, setName] = useState("");
  const [iconMode, setIconMode] = useState<IconMode>("icon");
  const [emoji, setEmoji] = useState("");
  const [selectedIconId, setSelectedIconId] = useState<string>(DEFAULT_ICON_ID);
  const [selectedColor, setSelectedColor] = useState(SOFT_PALETTE[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSymbol =
    iconMode === "emoji" ? emoji : makeLucideSymbol(selectedIconId);

  function reset() {
    setName("");
    setEmoji("");
    setSelectedIconId(DEFAULT_ICON_ID);
    setSelectedColor(SOFT_PALETTE[0]);
    setIconMode("icon");
    setError(null);
    setLoading(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("symbol", currentSymbol);
    fd.set("color", selectedColor);
    const result = await addCategory(fd);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.category) {
      onAdded(result.category);
      reset();
      onClose();
    }
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />
      <div
        className={cn(
          "fixed bottom-0 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 flex flex-col rounded-t-3xl bg-[var(--surface)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">New Category</h2>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
          <div className="overflow-y-auto px-5 pb-4 space-y-4" style={{ maxHeight: "70dvh" }}>

            {/* Preview */}
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--background)] px-4 py-3 ring-1 ring-black/[0.06]">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${selectedColor}22`, color: selectedColor }}
              >
                <CategoryIcon symbol={currentSymbol} size={22} emojiSize="22px" />
              </div>
              <p className="text-[15px] font-medium text-[var(--foreground)]">{name || "Category name"}</p>
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Groceries"
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Icon mode toggle */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Icon</label>
              <div className="flex gap-1 rounded-full bg-black/[0.05] p-1 mb-3">
                {(["icon", "emoji"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setIconMode(m)}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                      iconMode === m ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--label-secondary)]"
                    )}
                  >
                    {m === "emoji" ? "Emoji" : "Icon"}
                  </button>
                ))}
              </div>

              {iconMode === "emoji" ? (
                <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                  placeholder="Paste an emoji"
                  className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-center text-[22px] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
                />
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {CATEGORY_LUCIDE_ICONS.map(({ id, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setSelectedIconId(id)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl transition-all",
                        selectedIconId === id
                          ? "bg-[var(--foreground)]/10 ring-2 ring-[var(--foreground)]/30 scale-95"
                          : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                      )}
                      style={selectedIconId === id ? { color: selectedColor } : undefined}
                    >
                      <Icon size={20} strokeWidth={2} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Color</label>
              <div className="flex gap-2 flex-wrap">
                {SOFT_PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setSelectedColor(c)}
                    className={cn("h-9 w-9 rounded-full transition-all",
                      selectedColor === c ? "ring-2 ring-offset-2 ring-[var(--foreground)]/50 scale-110" : ""
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{error}</p>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3 pb-8">
            <button type="submit" disabled={loading}
              className="flex h-13 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? "Adding…" : "Add Category"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
