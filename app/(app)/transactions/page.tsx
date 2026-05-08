import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TransactionsShell from "@/components/transactions-shell";
import type { DbTransaction, DbCategory, DbWallet, DbMember, DbHouseholdMembership, DbRecurringItem, DbPendingInvitation } from "@/lib/types";

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

  const [{ data: categoriesRaw }, { data: walletsRaw }, { data: membersRaw }, { data: txRaw }, { data: membershipsRaw }, { data: recurringRaw }, { data: invitationsRaw }] = await Promise.all([
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
  ]);

  const categories: DbCategory[] = categoriesRaw ?? [];
  const wallets: DbWallet[] = (walletsRaw ?? []).map((w: any) => ({
    ...w,
    initial_balance: Number(w.initial_balance ?? 0),
  }));

  const memberships: DbHouseholdMembership[] = (membershipsRaw ?? []).map((m: any) => ({
    household_id: m.household_id,
    role: m.role,
    household: Array.isArray(m.household) ? m.household[0] : m.household,
  })).filter((m: DbHouseholdMembership) => m.household);

  const members: Record<string, DbMember> = {};
  for (const row of membersRaw ?? []) {
    const p: any = Array.isArray((row as any).profile) ? (row as any).profile[0] : (row as any).profile;
    if (p?.id) members[p.id] = p;
  }

  const allTransactions: DbTransaction[] = (txRaw ?? []).map((t: any) => ({
    ...t,
    amount: Number(t.amount),
    categories: Array.isArray(t.categories) ? t.categories[0] ?? null : t.categories,
    wallets: Array.isArray(t.wallets) ? t.wallets[0] ?? null : t.wallets,
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

  const recurringItems: DbRecurringItem[] = (recurringRaw ?? []).map((r: any) => ({
    ...r,
    amount: Number(r.amount),
    categories: Array.isArray(r.categories) ? r.categories[0] ?? null : r.categories,
    wallets: Array.isArray(r.wallets) ? r.wallets[0] ?? null : r.wallets,
  }));

  const pendingInvitations: DbPendingInvitation[] = (invitationsRaw ?? []).map((i: any) => ({
    id: i.id,
    household_id: i.household_id,
    invited_by: i.invited_by,
    status: i.status,
    created_at: i.created_at,
    household: Array.isArray(i.household) ? i.household[0] : i.household,
    inviter: Array.isArray(i.inviter) ? i.inviter[0] ?? null : i.inviter,
  })).filter((i: DbPendingInvitation) => i.household);

  // Exclude transfers from income/expense aggregates — they net to zero across
  // the ledger (source expense + dest income same amount), so including them
  // would inflate both columns without changing the balance.
  const realTransactions = allTransactions.filter((t) => !t.transfer_pair_id);
  const income = realTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = realTransactions
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
      householdSymbol={(household as any).symbol ?? "🏠"}
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
