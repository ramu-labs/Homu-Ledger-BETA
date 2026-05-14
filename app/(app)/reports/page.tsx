import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import ReportsShell from "@/components/reports-shell";
import type { DbTransaction, DbCategory, DbMember, DbWallet } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ReportTransactionRow = Omit<DbTransaction, "amount" | "categories" | "wallets" | "peer_wallet" | "photo_url"> & {
  amount: number;
};

const QUERY_PAGE_SIZE = 1000;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function fetchReportTransactions(
  supabase: Supabase,
  householdId: string
): Promise<DbTransaction[]> {
  const rows: ReportTransactionRow[] = [];

  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      // photo_url isn't read by Reports; dropping it shaves ~5–8% off
      // the payload for households with lots of receipts.
      .select("id, type, amount, name, category_id, wallet_id, transfer_pair_id, recurring_item_id, date, created_by, created_at")
      .eq("household_id", householdId)
      .is("transfer_pair_id", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + QUERY_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load report transactions: ${error.message}`);
    rows.push(...((data ?? []) as ReportTransactionRow[]));
    if (!data || data.length < QUERY_PAGE_SIZE) break;
  }

  return rows.map((t) => ({
    ...t,
    amount: Number(t.amount),
    photo_url: null,
    categories: null,
    wallets: null,
  }));
}

export default async function ReportsPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.household_id) redirect("/onboarding");

  const { data: household } = await supabase
    .from("households")
    .select("id, currency")
    .eq("id", profile.household_id)
    .single();

  if (!household) redirect("/onboarding");

  const [transactions, { data: membersRaw }, { data: categoriesRaw }, { data: walletsRaw }] = await Promise.all([
    fetchReportTransactions(supabase, household.id),
    supabase
      .from("household_members")
      .select("profile:profiles(id, name, initials, avatar_color)")
      .eq("household_id", household.id),
    supabase
      .from("categories")
      .select("id, name, symbol, color, type")
      .eq("household_id", household.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("wallets")
      .select("id, name, symbol, color, initial_balance, is_default")
      .eq("household_id", household.id)
      .order("created_at", { ascending: true }),
  ]);

  const members: Record<string, DbMember> = {};
  for (const row of membersRaw ?? []) {
    const p = firstRelation(row.profile as DbMember | DbMember[] | null);
    if (p?.id) members[p.id] = p;
  }

  // Single timestamp captured at server-render time. We pass it through to
  // ReportsShell so the initial server-rendered HTML and the initial
  // client-side hydration use the SAME `now`, instead of each computing
  // their own `new Date()` which would diverge across day boundaries or
  // different timezones and produce a hydration warning.
  const nowISO = new Date().toISOString();

  return (
    <ReportsShell
      transactions={transactions}
      categories={(categoriesRaw ?? []) as DbCategory[]}
      wallets={(walletsRaw ?? []) as DbWallet[]}
      members={members}
      currency={household.currency ?? "IDR"}
      iconStyle={(profile.icon_style as "2d" | "3d") ?? "3d"}
      nowISO={nowISO}
    />
  );
}
