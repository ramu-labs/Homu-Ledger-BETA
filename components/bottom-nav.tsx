"use client";

import { usePathname, useRouter } from "next/navigation";
import { Wallet, PieChart, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { TapLink, TapButton } from "@/components/tap";
import { useT } from "@/lib/i18n/provider";

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
      className="fixed left-1/2 w-full max-w-md -translate-x-1/2 z-50"
      // Float the entire bar (background + icons) above the home indicator
      // by half the safe-area inset so it doesn't visually swallow the
      // indicator zone. On platforms without an inset, the bar sits flush
      // to the physical bottom.
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) / 2)",
        height: "84px",
      }}
    >
      <div className="relative h-full">
        <div className="absolute inset-x-0 bottom-0 h-[72px] border-t border-black/[0.06] bg-[var(--surface)] shadow-[0_-8px_24px_rgba(42,37,32,0.06)]" />

        {/* Each side cell is 1/3 of the bar's width with content centred
            inside. To pull the icons closer to the centre + button (away
            from the screen edges, which felt visually unbalanced), we
            shrink the side cells' usable space from their OUTER edge —
            `pl-8` on the left tab pushes its content right, `pr-8` on the
            right tab pushes its content left. The cell stays the same
            size so the tap target doesn't shrink. */}
        <div className="absolute inset-x-0 bottom-0 grid h-[72px] grid-cols-3 items-center">
          <NavTab
            href="/transactions"
            label={t("nav.transactions")}
            active={onTransactions}
            icon={<Wallet className="h-6 w-6" strokeWidth={onTransactions ? 2.25 : 1.75} />}
            className="pl-8"
          />

          <div className="flex items-center justify-center">
            <TapButton
              onTap={openAddTransaction}
              aria-label="Add transaction"
              className="flex h-16 w-16 -translate-y-4 items-center justify-center rounded-full bg-[var(--foreground)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] active:scale-95 transition-transform [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
            >
              <Plus className="h-7 w-7" strokeWidth={2.25} />
            </TapButton>
          </div>

          <NavTab
            href="/reports"
            label={t("nav.reports")}
            active={onReports}
            icon={<PieChart className="h-6 w-6" strokeWidth={onReports ? 2.25 : 1.75} />}
            className="pr-8"
          />
        </div>
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  active,
  icon,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  /** Extra classes applied to the link — used by the parent to add
   *  asymmetric padding that shifts the icon toward the centre + button. */
  className?: string;
}) {
  return (
    <TapLink
      href={href}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide transition-colors [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]",
        active ? "text-[var(--foreground)]" : "text-[var(--label-tertiary)]",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </TapLink>
  );
}
