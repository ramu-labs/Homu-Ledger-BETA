// Developer analytics — pure computation (RAM-18).
//
// The analytics_overview() RPC returns a JSON snapshot of raw rows; every
// metric is derived here so the SQL stays trivial and the logic stays
// type-checked and testable. Used by the page server component to build
// AnalyticsData, and by the shell to build the CSV export.
//
// "Active" = logged a non-transfer transaction. Transfers are excluded
// everywhere — a transfer is two rows and isn't a real income/expense
// entry, so counting it would double-count activity.

const DAY = 86_400_000;

// ── Raw shape returned by analytics_overview() ──────────────────────────
export type AnalyticsRaw = {
  generated_at: string;
  profiles: { id: string; name: string | null; created_at: string }[];
  transactions: {
    created_by: string | null;
    created_at: string;
    household_id: string;
    category_id: string | null;
    amount: number;
    type: "income" | "expense";
    has_note: boolean;
    has_photo: boolean;
    is_transfer: boolean;
  }[];
  categories: { id: string; household_id: string; name: string; is_default: boolean }[];
  wallets: { household_id: string }[];
  recurring_items: { created_by: string | null; household_id: string }[];
  household_members: { profile_id: string; household_id: string }[];
  households: { id: string; currency: string }[];
  category_hints: { source: string }[];
};

// ── Computed shape consumed by the UI ───────────────────────────────────
export type RankingRow = {
  pseudonym: string;
  name: string;
  txCount: number;
  lastActive: string | null; // ISO date (YYYY-MM-DD)
  wowChange: number | null; // fraction, e.g. 0.2 = +20%
  sparkline: number[]; // 4 weekly transaction counts, oldest → newest
};

export type AnalyticsData = {
  generatedAt: string;
  users: {
    total: number;
    new7d: number;
    new30d: number;
    dau: number;
    wau: number;
    mau: number;
    stickiness: number; // dau / mau
    activationRate: number; // signups who ever logged a transaction
  };
  retention: {
    d7: number | null;
    d7Cohort: number;
    d30: number | null;
    d30Cohort: number;
  };
  rankings: RankingRow[];
  adoption: {
    multiWalletHouseholds: number;
    customCategoryHouseholds: number;
    customCategoryShare: number;
    recurringUsers: number;
    multiLedgerUsers: number;
    photoTransactions: number;
    descriptionUsage: number;
  };
  ai: {
    hintsTotal: number;
    hintsUserConfirmed: number;
    userConfirmedRate: number | null;
  };
  financial: {
    byCurrency: { currency: string; avgTransaction: number; txCount: number }[];
    topCategories: { name: string; count: number }[];
    avgCategoriesPerUser: number;
  };
};

// Stable, non-reversible pseudonym for a user id (FNV-1a, 32-bit). Keeps
// the CSV export free of real ids and names while staying consistent
// across exports so rows can be matched over time.
export function pseudonymize(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return "u-" + (hash >>> 0).toString(16).padStart(8, "0");
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function computeAnalytics(raw: AnalyticsRaw): AnalyticsData {
  const now = Date.now();
  const profiles = raw.profiles ?? [];
  const allTx = raw.transactions ?? [];
  // Real income/expense entries only — transfers excluded everywhere.
  const tx = allTx.filter((t) => !t.is_transfer && t.created_by);

  // ── Users ──────────────────────────────────────────────────────────
  const total = profiles.length;
  const new7d = profiles.filter((p) => now - Date.parse(p.created_at) <= 7 * DAY).length;
  const new30d = profiles.filter((p) => now - Date.parse(p.created_at) <= 30 * DAY).length;

  const activeWithin = (windowDays: number): Set<string> => {
    const set = new Set<string>();
    for (const t of tx) {
      if (now - Date.parse(t.created_at) <= windowDays * DAY) set.add(t.created_by as string);
    }
    return set;
  };
  const dau = activeWithin(1).size;
  const wau = activeWithin(7).size;
  const mau = activeWithin(30).size;
  const stickiness = mau > 0 ? dau / mau : 0;

  // Per-user transaction list — reused for activation, retention, rankings.
  const txByUser = new Map<string, typeof tx>();
  for (const t of tx) {
    const list = txByUser.get(t.created_by as string);
    if (list) list.push(t);
    else txByUser.set(t.created_by as string, [t]);
  }
  const activationRate = total > 0 ? txByUser.size / total : 0;

  // ── Retention ──────────────────────────────────────────────────────
  // Of users who signed up at least N days ago, the fraction who logged
  // a transaction on or after their (signup + N days) — i.e. they were
  // still around a week / month in. Lenient "ever came back" definition;
  // directional only at beta sample sizes.
  const retentionAt = (n: number): { rate: number | null; cohort: number } => {
    const cohort = profiles.filter((p) => now - Date.parse(p.created_at) >= n * DAY);
    if (cohort.length === 0) return { rate: null, cohort: 0 };
    let retained = 0;
    for (const p of cohort) {
      const threshold = Date.parse(p.created_at) + n * DAY;
      const list = txByUser.get(p.id);
      if (list && list.some((t) => Date.parse(t.created_at) >= threshold)) retained++;
    }
    return { rate: retained / cohort.length, cohort: cohort.length };
  };
  const d7 = retentionAt(7);
  const d30 = retentionAt(30);

  // ── Rankings ───────────────────────────────────────────────────────
  const nameById = new Map(profiles.map((p) => [p.id, p.name ?? "—"]));
  const rankings: RankingRow[] = [];
  for (const [userId, list] of txByUser) {
    let lastMs = 0;
    const weeks = [0, 0, 0, 0]; // weeks ago: index 0 = 28–21d, 3 = 7–0d
    for (const t of list) {
      const ms = Date.parse(t.created_at);
      if (ms > lastMs) lastMs = ms;
      const ageDays = (now - ms) / DAY;
      if (ageDays <= 28) {
        const bucket = 3 - Math.min(3, Math.floor(ageDays / 7));
        weeks[bucket]++;
      }
    }
    const lastWeek = weeks[2];
    const thisWeek = weeks[3];
    const wowChange = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : thisWeek > 0 ? 1 : null;
    rankings.push({
      pseudonym: pseudonymize(userId),
      name: nameById.get(userId) ?? "—",
      txCount: list.length,
      lastActive: lastMs > 0 ? isoDate(lastMs) : null,
      wowChange,
      sparkline: weeks,
    });
  }
  rankings.sort((a, b) => b.txCount - a.txCount);
  const topRankings = rankings.slice(0, 20);

  // ── Feature adoption ───────────────────────────────────────────────
  const households = raw.households ?? [];
  const householdCount = households.length;

  const walletsByHousehold = countBy(raw.wallets ?? [], (w) => w.household_id);
  const multiWalletHouseholds =
    householdCount > 0
      ? [...walletsByHousehold.values()].filter((n) => n >= 2).length / householdCount
      : 0;

  const categories = raw.categories ?? [];
  const customByHousehold = new Set(
    categories.filter((c) => !c.is_default).map((c) => c.household_id)
  );
  const customCategoryHouseholds =
    householdCount > 0 ? customByHousehold.size / householdCount : 0;
  const customCategoryShare =
    categories.length > 0
      ? categories.filter((c) => !c.is_default).length / categories.length
      : 0;

  const recurringUserIds = new Set(
    (raw.recurring_items ?? []).map((r) => r.created_by).filter((id): id is string => !!id)
  );
  const recurringUsers = total > 0 ? recurringUserIds.size / total : 0;

  const householdsPerUser = countBy(raw.household_members ?? [], (m) => m.profile_id);
  const multiLedgerUsers =
    total > 0
      ? [...householdsPerUser.values()].filter((n) => n >= 2).length / total
      : 0;

  const photoTransactions =
    tx.length > 0 ? tx.filter((t) => t.has_photo).length / tx.length : 0;
  const descriptionUsage =
    tx.length > 0 ? tx.filter((t) => t.has_note).length / tx.length : 0;

  // ── AI categorization — proxy only ─────────────────────────────────
  // There is no per-transaction record of the AI's guess (the category_ai
  // flag is client-side state, never persisted). The closest durable
  // signal is category_hints.source: 'user' means a user confirmed or
  // corrected that keyword→category mapping, 'ai' means it is still an
  // unconfirmed AI guess. A precise accuracy metric needs RAM-19.
  const hints = raw.category_hints ?? [];
  const hintsUserConfirmed = hints.filter((h) => h.source === "user").length;
  const ai = {
    hintsTotal: hints.length,
    hintsUserConfirmed,
    userConfirmedRate: hints.length > 0 ? hintsUserConfirmed / hints.length : null,
  };

  // ── Financial behavior ─────────────────────────────────────────────
  const currencyByHousehold = new Map(households.map((h) => [h.id, h.currency || "—"]));
  const currencyAgg = new Map<string, { sum: number; count: number }>();
  for (const t of tx) {
    const cur = currencyByHousehold.get(t.household_id) ?? "—";
    const a = currencyAgg.get(cur) ?? { sum: 0, count: 0 };
    a.sum += Number(t.amount) || 0;
    a.count++;
    currencyAgg.set(cur, a);
  }
  const byCurrency = [...currencyAgg.entries()]
    .map(([currency, a]) => ({
      currency,
      avgTransaction: a.count > 0 ? Math.round(a.sum / a.count) : 0,
      txCount: a.count,
    }))
    .sort((a, b) => b.txCount - a.txCount);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const categoryCount = countBy(
    tx.filter((t) => t.category_id),
    (t) => t.category_id as string
  );
  const topCategories = [...categoryCount.entries()]
    .map(([id, count]) => ({ name: categoryName.get(id) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  let distinctCategorySum = 0;
  for (const list of txByUser.values()) {
    distinctCategorySum += new Set(
      list.map((t) => t.category_id).filter((c): c is string => !!c)
    ).size;
  }
  const avgCategoriesPerUser =
    txByUser.size > 0 ? distinctCategorySum / txByUser.size : 0;

  return {
    generatedAt: raw.generated_at,
    users: { total, new7d, new30d, dau, wau, mau, stickiness, activationRate },
    retention: { d7: d7.rate, d7Cohort: d7.cohort, d30: d30.rate, d30Cohort: d30.cohort },
    rankings: topRankings,
    adoption: {
      multiWalletHouseholds,
      customCategoryHouseholds,
      customCategoryShare,
      recurringUsers,
      multiLedgerUsers,
      photoTransactions,
      descriptionUsage,
    },
    ai,
    financial: { byCurrency, topCategories, avgCategoriesPerUser },
  };
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// ── CSV export ────────────────────────────────────────────────────────
// Pseudonymized: hashed ids, no names. Safe to hand to an external AI
// tool for analysis. The on-screen ranking table keeps names so the
// developer can still map a pseudonym back for interviews.
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function pct(v: number | null): string {
  return v === null ? "n/a" : `${Math.round(v * 100)}%`;
}

export function buildAnalyticsCsv(d: AnalyticsData): string {
  const rows: (string | number)[][] = [];
  rows.push(["HOMU Analytics Export"]);
  rows.push(["Generated at", d.generatedAt]);
  rows.push([]);

  rows.push(["Users"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Total users", d.users.total]);
  rows.push(["New users (7d)", d.users.new7d]);
  rows.push(["New users (30d)", d.users.new30d]);
  rows.push(["DAU", d.users.dau]);
  rows.push(["WAU", d.users.wau]);
  rows.push(["MAU", d.users.mau]);
  rows.push(["Stickiness (DAU/MAU)", pct(d.users.stickiness)]);
  rows.push(["Activation rate", pct(d.users.activationRate)]);
  rows.push([]);

  rows.push(["Retention"]);
  rows.push(["Metric", "Value", "Cohort size"]);
  rows.push(["D7 retention", pct(d.retention.d7), d.retention.d7Cohort]);
  rows.push(["D30 retention", pct(d.retention.d30), d.retention.d30Cohort]);
  rows.push([]);

  rows.push(["User rankings (pseudonymized)"]);
  rows.push(["Pseudonym", "Transactions", "Last active", "WoW change"]);
  for (const r of d.rankings) {
    rows.push([
      r.pseudonym,
      r.txCount,
      r.lastActive ?? "n/a",
      r.wowChange === null ? "n/a" : `${r.wowChange >= 0 ? "+" : ""}${Math.round(r.wowChange * 100)}%`,
    ]);
  }
  rows.push([]);

  rows.push(["Feature adoption"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Multi-wallet households", pct(d.adoption.multiWalletHouseholds)]);
  rows.push(["Households with custom categories", pct(d.adoption.customCategoryHouseholds)]);
  rows.push(["Custom-category share", pct(d.adoption.customCategoryShare)]);
  rows.push(["Users with a recurring item", pct(d.adoption.recurringUsers)]);
  rows.push(["Users in 2+ ledgers", pct(d.adoption.multiLedgerUsers)]);
  rows.push(["Transactions with a photo", pct(d.adoption.photoTransactions)]);
  rows.push(["Transactions with a description", pct(d.adoption.descriptionUsage)]);
  rows.push([]);

  rows.push(["AI categorization (proxy)"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Learned category mappings", d.ai.hintsTotal]);
  rows.push(["User-confirmed", d.ai.hintsUserConfirmed]);
  rows.push(["User-confirmed rate", pct(d.ai.userConfirmedRate)]);
  rows.push([]);

  rows.push(["Financial behavior"]);
  rows.push(["Avg transaction size by currency"]);
  rows.push(["Currency", "Avg transaction", "Transactions"]);
  for (const c of d.financial.byCurrency) {
    rows.push([c.currency, c.avgTransaction, c.txCount]);
  }
  rows.push([]);
  rows.push(["Top categories"]);
  rows.push(["Category", "Transactions"]);
  for (const c of d.financial.topCategories) {
    rows.push([c.name, c.count]);
  }
  rows.push([]);
  rows.push(["Avg distinct categories per user", d.financial.avgCategoriesPerUser.toFixed(1)]);

  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
