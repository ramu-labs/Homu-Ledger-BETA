import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportsShell from "@/components/reports-shell";
import type { DbTransaction, DbCategory, DbMember } from "@/lib/types";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, household_id, icon_style")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) redirect("/onboarding");

  const { data: household } = await supabase
    .from("households")
    .select("id, currency")
    .eq("id", profile.household_id)
    .single();

  if (!household) redirect("/onboarding");

  const [{ data: txRaw }, { data: membersRaw }, { data: categoriesRaw }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, amount, name, category_id, wallet_id, date, created_by, created_at, photo_url, categories(id, name, symbol, color), wallets(id, name, symbol, color, initial_balance, is_default)")
      .eq("household_id", household.id)
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("household_members")
      .select("profile:profiles(id, name, initials, avatar_color)")
      .eq("household_id", household.id),
    supabase
      .from("categories")
      .select("id, name, symbol, color")
      .eq("household_id", household.id)
      .order("created_at", { ascending: true }),
  ]);

  const transactions: DbTransaction[] = (txRaw ?? []).map((t: any) => ({
    ...t,
    amount: Number(t.amount),
    categories: Array.isArray(t.categories) ? t.categories[0] ?? null : t.categories,
    wallets: Array.isArray(t.wallets) ? t.wallets[0] ?? null : t.wallets,
  }));

  const members: Record<string, DbMember> = {};
  for (const row of membersRaw ?? []) {
    const p: any = Array.isArray((row as any).profile) ? (row as any).profile[0] : (row as any).profile;
    if (p?.id) members[p.id] = p;
  }

  return (
    <ReportsShell
      transactions={transactions}
      categories={(categoriesRaw ?? []) as DbCategory[]}
      members={members}
      currency={household.currency ?? "IDR"}
      iconStyle={profile.icon_style ?? "3d"}
    />
  );
}
