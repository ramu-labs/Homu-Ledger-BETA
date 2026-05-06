import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TransactionsShell from "@/components/transactions-shell";
import type { DbTransaction, DbCategory, DbMember, DbHouseholdMembership, DbRecurringItem, DbPendingInvitation } from "@/lib/types";

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

  const [{ data: categoriesRaw }, { data: membersRaw }, { data: txRaw }, { data: membershipsRaw }, { data: recurringRaw }, { data: invitationsRaw }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, symbol, color")
      .eq("household_id", household.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("household_members")
      .select("profile:profiles(id, name, initials, avatar_color)")
      .eq("household_id", household.id),
    supabase
      .from("transactions")
      .select("id, type, amount, name, category_id, date, created_by, created_at, photo_url, categories(id, name, symbol, color)")
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
      .select("id, type, amount, name, category_id, frequency, next_due_date, repeat_until, created_by, created_at, categories(id, name, symbol, color)")
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

  const transactions: DbTransaction[] = (txRaw ?? []).map((t: any) => ({
    ...t,
    amount: Number(t.amount),
    categories: Array.isArray(t.categories) ? t.categories[0] ?? null : t.categories,
  }));

  const recurringItems: DbRecurringItem[] = (recurringRaw ?? []).map((r: any) => ({
    ...r,
    amount: Number(r.amount),
    categories: Array.isArray(r.categories) ? r.categories[0] ?? null : r.categories,
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

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = Number(household.opening_balance) + income - expenses;

  return (
    <TransactionsShell
      transactions={transactions}
      categories={categories}
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
      iconStyle={profile.icon_style ?? "3d"}
    />
  );
}
