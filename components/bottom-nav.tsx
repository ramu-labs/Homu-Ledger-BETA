"use client";

import { usePathname, useRouter } from "next/navigation";
import { Wallet, PieChart, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { TapLink, TapButton } from "@/components/tap";
import { useT } from "@/lib/i18n/provider";

/**
 * Floating-capsule bottom navigation.
 *
 * Sits 16px above the iPhone home-indicator zone, doesn't touch the screen
 * edges. Three items live inside a single rounded-full pill: two side tabs
 * (Transactions, Reports) and a centred + button.
 *
 * Anchored to the bottom of the viewport via `bottom: calc(env(safe-area-
 * inset-bottom) + 16px)` so it always clears the home indicator.
 *
 * Press animations:
 * - Side tabs: subtle scale-95 on press, background-tint when active.
 * - Centre + button: scale-90 on press with the shadow softening as it
 *   compresses, simulating a button being pushed in.
 */
export default function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const onTransactions = pathname.startsWith("/transactions");
  const onReports = pathname.startsWith("/reports");

  function openAddTransaction() {
    if (onTransactions) {
      window.dispatchEvent(new CustomEvent("fl:open-add-transaction"));
    } else {
      router.push("/transactions?new=1");
    }
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed left-1/2 z-50 -translate-x-1/2"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <div className="flex items-center gap-1 rounded-full bg-[var(--surface)] p-1.5 shadow-[0_12px_36px_rgba(42,37,32,0.18)] ring-1 ring-black/[0.04]">
        <NavTab
          href="/transactions"
          label={t("nav.transactions")}
          active={onTransactions}
          icon={<Wallet className="h-5 w-5" strokeWidth={onTransactions ? 2.4 : 1.85} />}
        />

        <TapButton
          onTap={openAddTransaction}
          aria-label="Add transaction"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--foreground)] text-white shadow-[0_6px_18px_rgba(0,0,0,0.22)] transition-[transform,box-shadow] duration-150 ease-out active:scale-90 active:shadow-[0_2px_8px_rgba(0,0,0,0.18)] [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </TapButton>

        <NavTab
          href="/reports"
          label={t("nav.reports")}
          active={onReports}
          icon={<PieChart className="h-5 w-5" strokeWidth={onReports ? 2.4 : 1.85} />}
        />
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <TapLink
      href={href}
      aria-label={label}
      className={cn(
        "flex h-12 items-center justify-center gap-1.5 rounded-full transition-all duration-200 ease-out active:scale-95 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]",
        active
          ? "bg-[var(--foreground)]/[0.06] px-4 text-[var(--foreground)]"
          : "px-4 text-[var(--label-tertiary)]"
      )}
    >
      {icon}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap text-[12px] font-semibold tracking-tight transition-all duration-200 ease-out",
          active ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
        )}
      >
        {label}
      </span>
    </TapLink>
  );
}
