import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TransactionsShell from "@/components/transactions-shell";
import type { DbTransaction, DbCategory, DbWallet, DbMember, DbHousehold, DbHouseholdMembership, DbRecurringItem, DbPendingInvitation } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type LedgerTotalRow = {
  type: "income" | "expense";
  amount: number;
};
type TransactionRowWithRelations = Omit<DbTransaction, "amount" | "categories" | "wallets" | "peer_wallet"> & {
  amount: number;
  categories: DbCategory | DbCategory[] | null;
  wallets: DbWallet | DbWallet[] | null;
};
type RecurringRowWithRelations = Omit<DbRecurringItem, "amount" | "categories" | "wallets"> & {
  amount: number;
  categories: DbCategory | DbCategory[] | null;
  wallets: DbWallet | DbWallet[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const QUERY_PAGE_SIZE = 1000;

async function fetchLedgerTotalRows(
  supabase: Supabase,
  householdId: string
): Promise<LedgerTotalRow[]> {
  const rows: LedgerTotalRow[] = [];

  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("household_id", householdId)
      .is("transfer_pair_id", null)
      .range(from, from + QUERY_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load ledger totals: ${error.message}`);
    rows.push(...((data ?? []) as LedgerTotalRow[]));
    if (!data || data.length < QUERY_PAGE_SIZE) break;
  }

  return rows;
}

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, initials, avatar_color, household_id, icon_style")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) redirect("/onboarding");

  const { data: household } = await supabase
    .from("households")
    .select("id, name, opening_balance, currency, symbol")
    .eq("id", profile.household_id)
    .single();

  if (!household) redirect("/onboarding");

  const [{ data: categoriesRaw }, { data: walletsRaw }, { data: membersRaw }, { data: txRaw }, { data: membershipsRaw }, { data: recurringRaw }, { data: invitationsRaw }, totalRows] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, symbol, color")
      .eq("household_id", household.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("wallets")
      .select("id, name, symbol, color, initial_balance, is_default")
      .eq("household_id", household.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("household_members")
      .select("profile:profiles(id, name, initials, avatar_color)")
      .eq("household_id", household.id),
    supabase
      .from("transactions")
      .select("id, type, amount, name, category_id, wallet_id, transfer_pair_id, date, created_by, created_at, photo_url, categories(id, name, symbol, color), wallets(id, name, symbol, color, initial_balance, is_default)")
      .eq("household_id", household.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("household_members")
      .select("household_id, role, household:households(id, name, currency, symbol)")
      .eq("profile_id", profile.id),
    supabase
      .from("recurring_items")
      .select("id, type, amount, name, category_id, wallet_id, frequency, next_due_date, repeat_until, created_by, created_at, categories(id, name, symbol, color), wallets(id, name, symbol, color, initial_balance, is_default)")
      .eq("household_id", household.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("household_invitations")
      .select("id, household_id, invited_by, status, created_at, household:households(id, name, symbol, currency), inviter:profiles!household_invitations_invited_by_fkey(id, name, initials, avatar_color)")
      .eq("invited_user_id", profile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    fetchLedgerTotalRows(supabase, household.id),
  ]);

  const categories: DbCategory[] = categoriesRaw ?? [];
  const wallets: DbWallet[] = (walletsRaw ?? []).map((w) => ({
    ...w,
    initial_balance: Number(w.initial_balance ?? 0),
  }));

  const memberships: DbHouseholdMembership[] = (membershipsRaw ?? []).flatMap((m) => {
    const membershipHousehold = firstRelation(m.household as DbHousehold | DbHousehold[] | null);
    if (!membershipHousehold) return [];
    return [{
      household_id: m.household_id,
      role: m.role as "owner" | "member",
      household: membershipHousehold,
    }];
  });

  const members: Record<string, DbMember> = {};
  for (const row of membersRaw ?? []) {
    const p = firstRelation(row.profile as DbMember | DbMember[] | null);
    if (p?.id) members[p.id] = p;
  }

  const allTransactions: DbTransaction[] = ((txRaw ?? []) as TransactionRowWithRelations[]).map((t) => ({
    ...t,
    amount: Number(t.amount),
    categories: firstRelation(t.categories),
    wallets: firstRelation(t.wallets),
  }));

  // Build pair_id → peer wallet map for transfer rendering. The DEST side
  // (type='income') of each transfer holds the destination wallet info; we
  // attach it to the SOURCE side so the list can show "From → To" in one row.
  const peerWalletByPair = new Map<string, DbTransaction["wallets"]>();
  for (const t of allTransactions) {
    if (t.transfer_pair_id && t.type === "income") {
      peerWalletByPair.set(t.transfer_pair_id, t.wallets);
    }
  }

  // Display list: drop the destination side of each transfer pair, attach
  // peer_wallet to the source side. Regular tx pass through unchanged.
  const transactions: DbTransaction[] = allTransactions
    .filter((t) => !(t.transfer_pair_id && t.type === "income"))
    .map((t) =>
      t.transfer_pair_id
        ? { ...t, peer_wallet: peerWalletByPair.get(t.transfer_pair_id) ?? null }
        : t
    );

  const recurringItems: DbRecurringItem[] = ((recurringRaw ?? []) as RecurringRowWithRelations[]).map((r) => ({
    ...r,
    amount: Number(r.amount),
    categories: firstRelation(r.categories),
    wallets: firstRelation(r.wallets),
  }));

  const pendingInvitations: DbPendingInvitation[] = (invitationsRaw ?? []).flatMap((i) => {
    const invitationHousehold = firstRelation(i.household as DbPendingInvitation["household"] | DbPendingInvitation["household"][] | null);
    if (!invitationHousehold) return [];
    return [{
      id: i.id,
      household_id: i.household_id,
      invited_by: i.invited_by,
      status: i.status as DbPendingInvitation["status"],
      created_at: i.created_at,
      household: invitationHousehold,
      inviter: firstRelation(i.inviter as DbPendingInvitation["inviter"] | DbPendingInvitation["inviter"][] | null),
    }];
  });

  // Exclude transfers from income/expense aggregates — they net to zero across
  // the ledger (source expense + dest income same amount), so including them
  // would inflate both columns without changing the balance.
  const income = totalRows
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = totalRows
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = Number(household.opening_balance) + income - expenses;

  return (
    <TransactionsShell
      transactions={transactions}
      categories={categories}
      wallets={wallets}
      members={members}
      householdName={household.name}
      householdId={household.id}
      householdSymbol={household.symbol ?? "🏠"}
      currency={household.currency ?? "IDR"}
      balance={balance}
      income={income}
      expenses={expenses}
      currentUser={{ initials: profile.initials, avatar_color: profile.avatar_color }}
      memberships={memberships}
      pendingInvitations={pendingInvitations}
      recurringItems={recurringItems}
      iconStyle={(profile.icon_style as "2d" | "3d") ?? "3d"}
    />
  );
}
