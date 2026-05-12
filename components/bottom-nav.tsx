"use client";

import { usePathname, useRouter } from "next/navigation";
import { Wallet, PieChart, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { TapLink, TapButton } from "@/components/tap";
import { useT } from "@/lib/i18n/provider";

/**
 * Floating-capsule bottom navigation.
 *
 * Sits 8px above the iPhone home-indicator zone, doesn't touch the screen
 * edges. A single rounded-full pill contains three items: two side tabs
 * (Transactions, Reports) with icon-above-label, and a centred + button.
 *
 * Layout is fixed across active/inactive states (each tab is `h-14 w-20`,
 * the + button is `h-14 w-14`) so the centre button never shifts position
 * — only colour and a soft pill background change on the active side tab.
 *
 * Press animation: only the centre + button gets a tactile press effect
 * (scale-90 with a softer shadow). Side tabs intentionally have no scale
 * animation so they don't visually nudge the centre button.
 */
export default function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const onTransactions = pathname.startsWith("/transactions");
  const onReports = pathname.startsWith("/reports");

  // Hide on Settings (and its subroutes) — those screens have their own
  // navigation context (back button + section list) and don't need the
  // global bottom bar in the way. Also hide on the developer-only
  // /design-system route, which renders edge-to-edge.
  if (pathname.startsWith("/settings") || pathname.startsWith("/design-system")) return null;

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
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Tighter shadow — close to the bar (small y-offset, moderate blur)
          plus a tiny secondary shadow for crisp lift. Reads as depth against
          the warm cream page bg even though the bar's surface colour is
          close to the page. */}
      {/* Outline uses --foreground/15 instead of black/[0.04] so the ring is
          actually visible in dark mode (where black-on-dark disappears). In
          light mode this resolves to near-black at 15% alpha — a touch more
          contrast than before, which is fine since the floating bar was
          blending a little too much with the page background anyway. */}
      <div className="flex items-center gap-4 rounded-full bg-[var(--surface)] p-2 shadow-[0_6px_18px_rgba(42,37,32,0.12),0_1px_4px_rgba(42,37,32,0.08)] ring-1 ring-[var(--foreground)]/15">
        <NavTab
          href="/transactions"
          label={t("nav.transactions")}
          active={onTransactions}
          icon={<Wallet className="h-5 w-5" strokeWidth={onTransactions ? 2.4 : 1.9} />}
        />

        <TapButton
          onTap={openAddTransaction}
          aria-label="Add transaction"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--on-foreground)] shadow-[0_6px_18px_rgba(0,0,0,0.22)] transition-[transform,box-shadow] duration-150 ease-out active:scale-90 active:shadow-[0_2px_8px_rgba(0,0,0,0.18)] [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
        >
          <Plus className="h-7 w-7" strokeWidth={2.5} />
        </TapButton>

        <NavTab
          href="/reports"
          label={t("nav.reports")}
          active={onReports}
          icon={<PieChart className="h-5 w-5" strokeWidth={onReports ? 2.4 : 1.9} />}
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
        // Fixed dimensions so active/inactive tabs don't change layout — that
        // way the centre + button stays anchored in place. Only the colour
        // + background pill change between states.
        "flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 ease-out [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]",
        active
          ? "bg-[var(--foreground)]/[0.06] text-[var(--foreground)]"
          : "text-[var(--label-tertiary)]"
      )}
    >
      {icon}
      <span className="text-[10px] font-semibold tracking-tight">{label}</span>
    </TapLink>
  );
}
