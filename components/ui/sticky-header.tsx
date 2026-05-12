"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  /** Where to navigate back to. If omitted, calls router.back(). */
  backHref?: string;
  /** Optional element rendered on the right (e.g. an action button). Reserves
   *  the 36px spacer slot otherwise so the title stays centered. */
  right?: React.ReactNode;
  className?: string;
};

/**
 * Page-level sticky header used across Settings sub-pages, Reports,
 * Transactions, Wallets, etc. Sits flush below the status-bar shield
 * (top: env(safe-area-inset-top)) and uses --background/95 + backdrop-blur.
 */
export default function StickyHeader({ title, backHref, right, className }: Props) {
  const router = useRouter();
  const backClassName =
    "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--ring-default)] shadow-[var(--shadow-card)] active:scale-95 transition-transform";

  return (
    <header
      className={cn(
        "sticky top-[env(safe-area-inset-top)] z-[var(--z-header)] flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-3 backdrop-blur",
        className
      )}
    >
      {backHref ? (
        <Link href={backHref} aria-label="Back" className={backClassName}>
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </Link>
      ) : (
        <button onClick={() => router.back()} aria-label="Back" className={backClassName}>
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
      )}
      <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
      <div className="h-9 w-9 flex items-center justify-end">{right ?? null}</div>
    </header>
  );
}
