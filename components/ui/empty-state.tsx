import { cn } from "@/lib/cn";

type Props = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Reusable empty-state card. Used by the feedback admin's "No tickets here",
 * the recurring-item list's "No subscriptions yet", and the category
 * drilldown's "No transactions in this period".
 */
export default function EmptyState({ icon, title, subtitle, action, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-[var(--ring-subtle)]",
        className
      )}
    >
      {icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ring-subtle)] text-[var(--label-secondary)]">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
      {subtitle && <p className="mt-1 text-[13px] text-[var(--label-secondary)]">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
