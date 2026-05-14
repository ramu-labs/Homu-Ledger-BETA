// AI dev panel.
//
// v1.26.0 split: this page is now read-only (stats + chart + rate-limit
// reference). The key form lives at /settings/ai-admin/key. Stops a
// stray tap on Clear from nuking the key when you only meant to glance
// at usage.
//
// Time range comes in via `?range=7d|28d|90d` (default 28d). Server
// fetches the right window, the client just renders.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AiAdminShell from "@/components/ai-admin-shell";

type DailyRow = {
  day: string;        // ISO date (YYYY-MM-DD)
  hits: number;
  misses: number;
  errors: number;
  tokens: number;
  cost: number;
};

// Free-tier limits for gemini-2.5-flash-lite per Google's published
// dashboard. Mirrored on the client to draw the progress bars. Kept
// in the page (not the shell) so a future per-key dynamic lookup
// could replace the constants without touching the chart logic.
const FREE_TIER = {
  rpm: 15,
  rpd: 1_000,
  // Google's TPM is published as "250K" — we store the raw integer so
  // arithmetic stays simple.
  tpm: 250_000,
};

const RANGES = { "7d": 7, "28d": 28, "90d": 90 } as const;
type RangeKey = keyof typeof RANGES;

function parseRange(raw: string | string[] | undefined): RangeKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "7d" || v === "28d" || v === "90d") return v;
  return "28d";
}

export default async function AiAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireSession();
  if (!profile?.is_developer) notFound();

  const params = await searchParams;
  const range = parseRange(params.range);
  const days = RANGES[range];

  // Has a Gemini API key been saved? Just a yes/no flag — the actual
  // value never leaves the server. Powers the "Configured" / "Not yet
  // configured" hint on the RowLink to /key.
  const { data: keyRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .maybeSingle();
  const keyConfigured = !!keyRow?.value && keyRow.value.trim().length > 0;

  // Time window — `days` is a count back from today (inclusive of
  // today). Truncate to UTC midnight so SQL bucketing lines up with
  // calendar days in the chart.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  // Two queries in parallel:
  //   1. The full range for the chart + range-window totals.
  //   2. A tiny "right-now" snapshot (last 1 min / 1 day) via the
  //      api_usage_recent_window RPC so the usage-vs-limit bars show
  //      live numbers regardless of the user's selected range.
  const [logsRes, liveRes] = await Promise.all([
    supabase
      .from("api_usage_logs")
      .select("input_tokens, output_tokens, total_tokens, estimated_cost_usd, cache_status, created_at")
      .gte("created_at", since.toISOString()),
    supabase.rpc("api_usage_recent_window"),
  ]);

  const logs = logsRes.data ?? [];

  // The RPC returns a single-row table. Defensive defaults — if the
  // RPC ever fails or returns nothing we render zeros (means "no
  // recent calls", which is correct for a fresh install).
  const liveRow = Array.isArray(liveRes.data) ? liveRes.data[0] : liveRes.data;
  const live = {
    rpm: Number(liveRow?.rpm_now ?? 0),
    rpd: Number(liveRow?.rpd_now ?? 0),
    tpm: Number(liveRow?.tpm_now ?? 0),
    rpmErrors: Number(liveRow?.rpm_errors ?? 0),
  };

  // ── Totals for the headline card. Hit rate is hits / (hits+misses);
  //    errors are excluded so a flaky network call doesn't penalise
  //    the cache stat. Input / output tokens are summed separately so
  //    the dev panel can show the split — Google bills them at
  //    different rates ($0.10 vs $0.40 per 1M). ────────────────────
  const totals = logs.reduce(
    (acc, row) => {
      acc.calls += 1;
      acc.tokens += row.total_tokens ?? 0;
      acc.inputTokens += row.input_tokens ?? 0;
      acc.outputTokens += row.output_tokens ?? 0;
      acc.cost += Number(row.estimated_cost_usd ?? 0);
      if (row.cache_status === "hit") acc.hits += 1;
      else if (row.cache_status === "miss") acc.misses += 1;
      else if (row.cache_status === "error") acc.errors += 1;
      return acc;
    },
    { calls: 0, tokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, hits: 0, misses: 0, errors: 0 }
  );
  const hitDenom = totals.hits + totals.misses;
  const hitRate = hitDenom > 0 ? totals.hits / hitDenom : null;

  // ── Per-day bucket for the chart. We bucket in JS (not SQL) so the
  //    code stays portable and we can fill empty days with zeros —
  //    Recharts needs every day represented, even ones with no calls,
  //    or the X-axis ends up uneven. ──────────────────────────────
  const buckets = new Map<string, DailyRow>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, hits: 0, misses: 0, errors: 0, tokens: 0, cost: 0 });
  }
  for (const row of logs) {
    const day = String(row.created_at).slice(0, 10);
    const b = buckets.get(day);
    if (!b) continue;
    if (row.cache_status === "hit") b.hits += 1;
    else if (row.cache_status === "miss") b.misses += 1;
    else if (row.cache_status === "error") b.errors += 1;
    b.tokens += row.total_tokens ?? 0;
    b.cost += Number(row.estimated_cost_usd ?? 0);
  }
  const daily: DailyRow[] = Array.from(buckets.values());

  return (
    <AiAdminShell
      keyConfigured={keyConfigured}
      range={range}
      stats={{
        calls: totals.calls,
        totalTokens: totals.tokens,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cost: totals.cost,
        hits: totals.hits,
        misses: totals.misses,
        errors: totals.errors,
        hitRate,
      }}
      live={live}
      limits={FREE_TIER}
      daily={daily}
    />
  );
}
