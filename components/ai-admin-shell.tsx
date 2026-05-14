"use client";

// AI dev panel — read-only summary + chart. Key management moved to
// /settings/ai-admin/key in v1.26.0. We deliberately keep this page
// non-destructive: no Save, no Clear, no API call buttons. That way
// the developer can glance at stats safely.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, Check, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { TapLink } from "@/components/tap";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

type Stats = {
  calls: number;
  totalTokens: number;
  cost: number;
  hits: number;
  misses: number;
  errors: number;
  hitRate: number | null;
};

type DailyRow = {
  day: string;
  hits: number;
  misses: number;
  errors: number;
  tokens: number;
  cost: number;
};

type RangeKey = "7d" | "28d" | "90d";

type Props = {
  keyConfigured: boolean;
  range: RangeKey;
  stats: Stats;
  daily: DailyRow[];
};

// Free tier limits per Google's published rate-limit dashboard for
// Gemini 2.5 Flash-Lite. Hard-coded as a reference panel so the dev
// doesn't have to dig through aistudio.google.com/rate-limit to see
// what tier they're on. If Google updates these, edit here.
const FREE_TIER_LIMITS = {
  rpm: 15,
  rpd: 1_000,
  tpm: "250K",
};

// Chart series — also exposed as a toggle. "Calls" (default) shows
// the cache-hit-vs-miss-vs-error split per day. "Tokens" overlays the
// raw token volume, useful when calls are sparse but tokens are
// chunky.
type Metric = "calls" | "tokens";

export default function AiAdminShell({ keyConfigured, range, stats, daily }: Props) {
  const router = useRouter();
  const t = useT();
  const [metric, setMetric] = useState<Metric>("calls");

  function setRange(next: RangeKey) {
    const url = new URL(window.location.href);
    url.searchParams.set("range", next);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("ai.admin.title")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-5 mt-2 text-[13px] text-[var(--label-secondary)]">
        {t("ai.admin.subtitle")}
      </p>

      {/* API key — RowLink to the dedicated key page. We surface the
          configured/not-configured status so the dev knows at a glance
          whether the feature is live. */}
      <section className="mx-5 mt-4 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04]">
        <TapLink
          href="/settings/ai-admin/key"
          className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">
            {t("ai.admin.keyHeading")}
          </p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              keyConfigured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            )}
          >
            {keyConfigured ? t("ai.admin.statusConfigured") : t("ai.admin.statusUnconfigured")}
          </span>
          <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
        </TapLink>
      </section>

      {/* Free-tier limits card. Reference for the developer ("how
          much can I push through before billing kicks in?"). Numbers
          are pulled from Google's published rate-limit dashboard. */}
      <section className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          {t("ai.admin.freeTierHeading")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <LimitCell label="RPM" value={String(FREE_TIER_LIMITS.rpm)} />
          <LimitCell label="RPD" value={FREE_TIER_LIMITS.rpd.toLocaleString()} />
          <LimitCell label="TPM" value={FREE_TIER_LIMITS.tpm} />
        </div>
        <p className="mt-3 text-[11px] text-[var(--label-tertiary)]">
          {t("ai.admin.freeTierHint")}
        </p>
      </section>

      {/* Range selector — chips above the chart so it's obvious which
          window the numbers below refer to. */}
      <section className="mx-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            {t("ai.admin.usageHeading")}
          </p>
          <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
            {(["7d", "28d", "90d"] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all",
                  range === r
                    ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--label-secondary)]"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Headline totals for the selected range. */}
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={t("ai.admin.usageHitRate")}
            value={stats.hitRate === null ? "—" : `${Math.round(stats.hitRate * 100)}%`}
            tone="primary"
          />
          <Stat
            label={t("ai.admin.usageCost")}
            value={`$${stats.cost.toFixed(4)}`}
            tone="primary"
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label={t("ai.admin.usageCalls")} value={String(stats.calls)} />
          <MiniStat label={t("ai.admin.usageTokens")} value={formatNumber(stats.totalTokens)} />
          <MiniStat
            label={t("ai.admin.usageHits")}
            value={String(stats.hits)}
            tone="ok"
          />
          <MiniStat label={t("ai.admin.usageMisses")} value={String(stats.misses)} />
          <MiniStat
            label={t("ai.admin.usageErrors")}
            value={String(stats.errors)}
            tone={stats.errors > 0 ? "warn" : "neutral"}
          />
        </div>
      </section>

      {/* Daily chart. Metric toggle above the bars so the dev can flip
          between "API calls per day" (default — shows the cache split)
          and "Tokens per day" (raw consumption signal). */}
      <section className="mx-5 mt-5 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            {metric === "calls" ? t("ai.admin.chartCalls") : t("ai.admin.chartTokens")}
          </p>
          <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
            {(["calls", "tokens"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all",
                  metric === m
                    ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--label-secondary)]"
                )}
              >
                {m === "calls" ? t("ai.admin.chartTabCalls") : t("ai.admin.chartTabTokens")}
              </button>
            ))}
          </div>
        </div>

        {stats.calls === 0 ? (
          <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-xl bg-[var(--background)] text-[var(--label-secondary)]">
            <AlertCircle className="h-5 w-5 text-[var(--label-tertiary)]" strokeWidth={2} />
            <p className="px-6 text-center text-[12px]">{t("ai.admin.usageEmpty")}</p>
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metric === "calls" ? (
                <BarChart data={daily} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => shortDate(d)}
                    tick={{ fontSize: 10, fill: "var(--label-tertiary)" }}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "var(--label-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.06)",
                      fontSize: 12,
                    }}
                    labelFormatter={(d) => longDate(String(d))}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="hits"   stackId="a" fill="#10b981" name={t("ai.admin.usageHits")} />
                  <Bar dataKey="misses" stackId="a" fill="#EE6452" name={t("ai.admin.usageMisses")} />
                  <Bar dataKey="errors" stackId="a" fill="#f43f5e" name={t("ai.admin.usageErrors")} />
                </BarChart>
              ) : (
                <BarChart data={daily} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => shortDate(d)}
                    tick={{ fontSize: 10, fill: "var(--label-tertiary)" }}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatNumber(v)}
                    tick={{ fontSize: 10, fill: "var(--label-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.06)",
                      fontSize: 12,
                    }}
                    labelFormatter={(d) => longDate(String(d))}
                    formatter={(v) => [formatNumber(Number(v)), t("ai.admin.usageTokens")]}
                  />
                  <Bar dataKey="tokens" fill="#3b82f6" name={t("ai.admin.usageTokens")} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-3",
        tone === "primary" ? "bg-[#EE6452]/10" : "bg-[var(--background)]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
        {label}
      </p>
      <p className="mt-0.5 text-[22px] font-semibold leading-tight text-[var(--foreground)] tabular-nums">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-rose-700"
      : "text-[var(--foreground)]";
  return (
    <div className="rounded-xl bg-[var(--background)] px-3 py-2 ring-1 ring-black/[0.04]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
        {label}
      </p>
      <p className={cn("mt-0.5 text-[15px] font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

function LimitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--background)] px-3 py-2 ring-1 ring-black/[0.04] text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
        {label}
      </p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function shortDate(iso: string): string {
  // "2026-05-12" → "May 12"
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
function longDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function formatNumber(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
