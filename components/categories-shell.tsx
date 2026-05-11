"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import EditCategorySheet from "@/components/edit-category-sheet";
import AddCategorySheet from "@/components/add-category-sheet";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/cn";
import type { DbCategory, TransactionType } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  categories: DbCategory[];
  iconStyle?: IconStyle;
};

export default function CategoriesShell({ categories: initial, iconStyle = "3d" }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initial);
  const [editing, setEditing] = useState<DbCategory | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");

  function openEdit(cat: DbCategory) {
    setEditing(cat);
    setSheetOpen(true);
  }

  function handleUpdated(updated: DbCategory) {
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleDeleted(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  function handleAdded(cat: DbCategory) {
    setCategories((prev) => [cat, ...prev]);
  }

  const visible = useMemo(
    () => categories.filter((c) => c.type === activeTab),
    [categories, activeTab]
  );

  return (
    <>
      <div className="pb-10">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-4 pb-2 backdrop-blur">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
          >
            <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
          </button>
          <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Categories</h1>
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Add category"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--foreground)] text-white shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
        </header>

        {/* Tabs */}
        <div className="px-5 mt-4">
          <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
            <TabBtn active={activeTab === "expense"} onClick={() => setActiveTab("expense")}>
              Expense
            </TabBtn>
            <TabBtn active={activeTab === "income"} onClick={() => setActiveTab("income")}>
              Income
            </TabBtn>
          </div>
        </div>

        <section className="mt-4">
          {visible.length === 0 ? (
            <p className="mx-5 rounded-2xl bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--label-secondary)] ring-1 ring-black/[0.04]">
              No {activeTab} categories yet. Tap + to add one.
            </p>
          ) : (
            <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
              {visible.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} iconStyle={iconStyle} onTap={openEdit} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <EditCategorySheet
        open={sheetOpen}
        category={editing}
        iconStyle={iconStyle}
        onClose={() => setSheetOpen(false)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />

      <AddCategorySheet
        open={addOpen}
        type={activeTab}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
        iconStyle={iconStyle}
      />
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--label-secondary)]"
      )}
    >
      {children}
    </button>
  );
}

function CategoryRow({
  cat,
  iconStyle = "3d",
  onTap,
}: {
  cat: DbCategory;
  iconStyle?: IconStyle;
  onTap: (c: DbCategory) => void;
}) {
  return (
    <li>
      <button
        onClick={() => onTap(cat)}
        className="flex w-full items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-black/[0.02] transition-colors"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px]"
          style={{ backgroundColor: `${cat.color}22` }}
        >
          <CategoryIcon
            symbol={cat.symbol}
            iconStyle={iconStyle}
            size={20}
            emojiSize="20px"
            color={iconStyle === "2d" ? cat.color : undefined}
          />
        </div>
        <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{cat.name}</p>
        <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
      </button>
    </li>
  );
}
