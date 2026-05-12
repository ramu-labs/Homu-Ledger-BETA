import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TransactionsShell from "@/components/transactions-shell";
import type { DbTransaction, DbCategory, DbWallet, DbMember, DbHousehold, DbHouseholdMembership, DbRecurringItem, DbPendingInvitation } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type LedgerTotalRow = { type: "income" | "expense"; amount: number };
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

// Initial server-render only fetches the most recent INITIAL_TX_LIMIT rows.
// The client requests older batches via /api/transactions when the user
// scrolls past the cached set. This caps the first-paint RSC payload at
// ~50 KB regardless of household size — important on 4G mobile.
const INITIAL_TX_LIMIT = 200;

async function fetchLedgerTransactions(
  supabase: Supabase,
  householdId: string
): Promise<TransactionRowWithRelations[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount, name, category_id, wallet_id, transfer_pair_id, recurring_item_id, date, created_by, created_at, photo_url, categories(id, name, symbol, color, type), wallets(id, name, symbol, color, initial_balance, is_default)")
    .eq("household_id", householdId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INITIAL_TX_LIMIT);

  if (error) throw new Error(`Failed to load transactions: ${error.message}`);
  return (data ?? []) as TransactionRowWithRelations[];
}

// Photos are stored as bare object paths (e.g. "<household_id>/<random>.jpg").
// The list view only needs to know IF a photo exists (camera icon); the edit
// sheet signs the URL on demand via signTransactionPhoto() so we don't burn
// an N×100ms storage round-trip on every page load.
function normalizePhotoPath(value: string | null): string | null {
  if (!value) return value;
  const publicPrefix = "/storage/v1/object/public/transaction-photos/";
  const publicIndex = value.indexOf(publicPrefix);
  if (publicIndex === -1) return value;
  return decodeURIComponent(value.slice(publicIndex + publicPrefix.length));
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

  // Auto-materialize any recurring items whose due date has passed.
  // SECURITY DEFINER RPC inserts transactions and advances next_due_date.
  // Best-effort: if the migration hasn't been applied to this DB yet, the
  // RPC won't exist — we swallow the error so the page still renders.
  await supabase.rpc("materialize_due_recurring_items").then(({ error }) => {
    if (error) console.warn("[recurring] materialize failed:", error.message);
  });

  const [{ data: categoriesRaw }, { data: walletsRaw }, { data: membersRaw }, txRaw, { data: membershipsRaw }, { data: recurringRaw }, { data: invitationsRaw }, totals] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, symbol, color, type")
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
    fetchLedgerTransactions(supabase, household.id),
    supabase
      .from("household_members")
      .select("household_id, role, household:households(id, name, currency, symbol)")
      .eq("profile_id", profile.id),
    supabase
      .from("recurring_items")
      .select("id, type, amount, name, category_id, wallet_id, frequency, next_due_date, repeat_until, created_by, created_at, categories(id, name, symbol, color, type), wallets(id, name, symbol, color, initial_balance, is_default)")
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

  // Send raw transactions; the client shell handles transfer-pair dedup +
  // peer-wallet attachment so the same logic also covers batches fetched
  // later via /api/transactions.
  const transactions: DbTransaction[] = (txRaw ?? []).map((t) => ({
    ...t,
    photo_url: normalizePhotoPath(t.photo_url),
    amount: Number(t.amount),
    categories: firstRelation(t.categories),
    wallets: firstRelation(t.wallets),
  }));

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

  const totalRows = totals;
  const income = totalRows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = totalRows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
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
