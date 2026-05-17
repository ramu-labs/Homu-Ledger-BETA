"use client";

// Developer analytics dashboard — read-only summary (RAM-18).
//
// Dev-only screen, mobile single-scroll. All metrics are computed in
// lib/analytics.ts; this shell just renders them and offers a
// pseudonymized CSV export. No mutations, no destructive actions.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { buildAnalyticsCsv, type AnalyticsData } from "@/lib/analytics";

type Props = {
  analytics: AnalyticsData | null;
  failed: boolean;
};

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export default function DevAnalyticsShell({ analytics, failed }: Props) {
  const router = useRouter();

  function handleExport() {
    if (!analytics) return;
    const csv = buildAnalyticsCsv(analytics);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homu-analytics-${analytics.generatedAt.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          Analytics
        </h1>
        <div className="h-9 w-9" />
      </header>

      {failed || !analytics ? (
        <div className="mx-5 mt-6 flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface)] p-8 text-center ring-1 ring-black/[0.04]">
          <AlertCircle className="h-6 w-6 text-[var(--label-tertiary)]" strokeWidth={2} />
          <p className="text-[14px] font-semibold text-[var(--foreground)]">
            Analytics unavailable
          </p>
          <p className="text-[12px] text-[var(--label-secondary)]">
            The <code className="font-mono">analytics_overview</code> function isn&apos;t
            responding. If this is a fresh deploy, apply migration{" "}
            <code className="font-mono">0031_analytics_overview.sql</code> to Supabase.
          </p>
        </div>
      ) : (
        <>
          <p className="px-5 mt-2 text-[13px] text-[var(--label-secondary)]">
            Developer-only. Computed live — at beta sample sizes, watch trends over
            weeks, not absolute numbers.
          </p>
          <p className="px-5 mt-1 text-[11px] text-[var(--label-tertiary)]">
            Snapshot: {new Date(analytics.generatedAt).toLocaleString()}
          </p>

          {/* ── Users ─────────────────────────────────────────────── */}
          <Section title="Users">
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Total" value={String(analytics.users.total)} />
              <Tile label="New · 7d" value={String(analytics.users.new7d)} />
              <Tile label="New · 30d" value={String(analytics.users.new30d)} />
              <Tile label="DAU" value={String(analytics.users.dau)} />
              <Tile label="WAU" value={String(analytics.users.wau)} />
              <Tile label="MAU" value={String(analytics.users.mau)} />
              <Tile label="Stickiness" value={pct(analytics.users.stickiness)} />
              <Tile
                label="Activation"
                value={pct(analytics.users.activationRate)}
                tone="primary"
              />
            </div>
          </Section>

          {/* ── Retention ─────────────────────────────────────────── */}
          <Section
            title="Retention"
            hint="Of users signed up ≥N days ago, the share who logged a transaction on or after day N."
          >
            <div className="grid grid-cols-2 gap-2">
              <Tile
                label="D7 retention"
                value={pct(analytics.retention.d7)}
                footer={`${analytics.retention.d7Cohort} in cohort`}
                tone="primary"
              />
              <Tile
                label="D30 retention"
                value={pct(analytics.retention.d30)}
                footer={`${analytics.retention.d30Cohort} in cohort`}
                tone="primary"
              />
            </div>
          </Section>

          {/* ── Rankings ──────────────────────────────────────────── */}
          <RankingsSection rankings={analytics.rankings} />

          {/* ── Feature adoption ──────────────────────────────────── */}
          <Section title="Feature adoption">
            <div className="space-y-2.5">
              <Bar label="Multi-wallet households" value={analytics.adoption.multiWalletHouseholds} />
              <Bar label="Households w/ custom categories" value={analytics.adoption.customCategoryHouseholds} />
              <Bar label="Custom-category share" value={analytics.adoption.customCategoryShare} />
              <Bar label="Users w/ a recurring item" value={analytics.adoption.recurringUsers} />
              <Bar label="Users in 2+ ledgers" value={analytics.adoption.multiLedgerUsers} />
              <Bar label="Transactions w/ a photo" value={analytics.adoption.photoTransactions} />
              <Bar label="Transactions w/ a description" value={analytics.adoption.descriptionUsage} />
            </div>
          </Section>

          {/* ── AI categorization ─────────────────────────────────── */}
          <Section
            title="AI categorization"
            hint="Proxy only — there is no per-transaction record of the AI's guess. 'User-confirmed' = learned mappings a user accepted or corrected."
          >
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Learned mappings" value={String(analytics.ai.hintsTotal)} />
              <Tile label="User-confirmed" value={String(analytics.ai.hintsUserConfirmed)} />
              <Tile label="Confirmed rate" value={pct(analytics.ai.userConfirmedRate)} />
            </div>
          </Section>

          {/* ── Financial behavior ────────────────────────────────── */}
          <Section title="Financial behavior">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
              Avg transaction by currency
            </p>
            {analytics.financial.byCurrency.length === 0 ? (
              <p className="text-[12px] text-[var(--label-secondary)]">No transactions yet.</p>
            ) : (
              <div className="space-y-1">
                {analytics.financial.byCurrency.map((c) => (
                  <div key={c.currency} className="flex items-baseline justify-between text-[13px]">
                    <span className="font-mono text-[var(--label-secondary)]">{c.currency}</span>
                    <span className="tabular-nums font-semibold text-[var(--foreground)]">
                      {c.avgTransaction.toLocaleString()}
                      <span className="ml-1.5 text-[11px] font-normal text-[var(--label-tertiary)]">
                        · {c.txCount} tx
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
              Top categories
            </p>
            {analytics.financial.topCategories.length === 0 ? (
              <p className="text-[12px] text-[var(--label-secondary)]">No transactions yet.</p>
            ) : (
              <div className="space-y-1">
                {analytics.financial.topCategories.map((c) => (
                  <div key={c.name} className="flex items-baseline justify-between text-[13px]">
                    <span className="truncate text-[var(--foreground)]">{c.name}</span>
                    <span className="ml-2 shrink-0 tabular-nums font-semibold text-[var(--label-secondary)]">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-[var(--separator)] pt-3">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-[var(--label-secondary)]">Avg distinct categories / user</span>
                <span className="tabular-nums font-semibold text-[var(--foreground)]">
                  {analytics.financial.avgCategoriesPerUser.toFixed(1)}
                </span>
              </div>
            </div>
          </Section>

          {/* ── Friction points ───────────────────────────────────── */}
          <Section
            title="Friction points"
            hint="Drop-off between paired UI events. Empty until event collection is enabled (consent — RAM-20)."
          >
            {analytics.friction.funnels.every((f) => f.started === 0) ? (
              <p className="text-[12px] text-[var(--label-secondary)]">
                No events captured yet.
              </p>
            ) : (
              <div className="space-y-3">
                {analytics.friction.funnels.map((f) => {
                  const rate = f.completionRate === null ? 0 : Math.round(f.completionRate * 100);
                  return (
                    <div key={f.label}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-medium text-[var(--foreground)]">{f.label}</p>
                        <p className="text-[12px] font-semibold tabular-nums text-[var(--label-secondary)]">
                          {f.completionRate === null ? "—" : `${rate}%`}
                        </p>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                        <div
                          className="h-full rounded-full bg-[#EE6452] transition-[width] duration-300"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] tabular-nums text-[var(--label-tertiary)]">
                        {f.started} started · {f.completed} completed ·{" "}
                        {Math.max(0, f.started - f.completed)} dropped
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Export ────────────────────────────────────────────── */}
          <div className="mx-5 mt-6">
            <button
              onClick={handleExport}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] px-4 py-3.5 text-[15px] font-semibold text-[var(--on-foreground)] active:scale-[0.99] transition-transform"
            >
              <Download className="h-[18px] w-[18px]" strokeWidth={2.25} />
              Export CSV
            </button>
            <p className="mt-2 px-1 text-[11px] text-[var(--label-tertiary)]">
              Pseudonymized — hashed ids, no names. Safe to hand to an AI tool for
              analysis. Cross-reference pseudonyms with the ranking list above.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
        {title}
      </p>
      {hint && (
        <p className="mt-1 mb-3 text-[11px] leading-snug text-[var(--label-tertiary)]">{hint}</p>
      )}
      <div className={cn(!hint && "mt-3")}>{children}</div>
    </section>
  );
}

function Tile({
  label,
  value,
  footer,
  tone = "neutral",
}: {
  label: string;
  value: string;
  footer?: string;
  tone?: "neutral" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5 ring-1 ring-black/[0.04]",
        tone === "primary" ? "bg-[#EE6452]/10" : "bg-[var(--background)]"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-semibold leading-tight tabular-nums text-[var(--foreground)]">
        {value}
      </p>
      {footer && (
        <p className="mt-0.5 text-[10px] tabular-nums text-[var(--label-tertiary)]">{footer}</p>
      )}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pctVal = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-[12px] text-[var(--foreground)]">{label}</p>
        <p className="text-[12px] font-semibold tabular-nums text-[var(--label-secondary)]">
          {pctVal}%
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
        <div
          className="h-full rounded-full bg-[#EE6452] transition-[width] duration-300"
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  );
}

function RankingsSection({
  rankings,
}: {
  rankings: AnalyticsData["rankings"];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rankings.slice(0, 20) : rankings.slice(0, 10);

  return (
    <Section title="User rankings" hint="Most active users by transactions logged.">
      {rankings.length === 0 ? (
        <p className="text-[12px] text-[var(--label-secondary)]">No active users yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--separator)]">
            {shown.map((r, i) => (
              <li key={r.pseudonym} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-center text-[12px] font-semibold tabular-nums text-[var(--label-tertiary)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[var(--foreground)]">
                    {r.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[var(--label-tertiary)]">
                    {r.pseudonym} · {r.lastActive ?? "—"}
                  </p>
                </div>
                <Sparkline data={r.sparkline} />
                <div className="w-12 shrink-0 text-right">
                  <p className="text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
                    {r.txCount}
                  </p>
                  {r.wowChange !== null && (
                    <p
                      className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        r.wowChange >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}
                    >
                      {r.wowChange >= 0 ? "+" : ""}
                      {Math.round(r.wowChange * 100)}%
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {rankings.length > 10 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full rounded-lg py-1.5 text-[12px] font-semibold text-[#EE6452] active:opacity-70"
            >
              {expanded ? "Show top 10" : `Show all ${Math.min(20, rankings.length)}`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

// Tiny 4-week activity sparkline. currentColor → label-tertiary.
function Sparkline({ data }: { data: number[] }) {
  const w = 44;
  const h = 16;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 text-[var(--label-tertiary)]"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
