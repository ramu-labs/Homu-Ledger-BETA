import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import WalletsShell from "@/components/wallets-shell";
import type { DbWallet } from "@/lib/types";

export default async function WalletsPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.household_id) redirect("/onboarding");

  const [{ data: walletsRaw }, { data: household }, { data: txRaw }] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, name, symbol, color, initial_balance, is_default")
      .eq("household_id", profile.household_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("households")
      .select("currency")
      .eq("id", profile.household_id)
      .single(),
    // Pull all txs once and aggregate per-wallet balance client-side.
    // For ~thousands of txs this is fine; if it grows we'd push this into a Postgres view.
    supabase
      .from("transactions")
      .select("wallet_id, type, amount")
      .eq("household_id", profile.household_id),
  ]);

  const wallets: DbWallet[] = (walletsRaw ?? []).map((w: any) => ({
    ...w,
    initial_balance: Number(w.initial_balance ?? 0),
  }));

  // Compute per-wallet balance: initial_balance + sum(income) - sum(expense)
  const txDeltaByWallet = new Map<string, number>();
  for (const t of txRaw ?? []) {
    if (!t.wallet_id) continue;
    const delta = (t.type === "income" ? 1 : -1) * Number(t.amount);
    txDeltaByWallet.set(t.wallet_id, (txDeltaByWallet.get(t.wallet_id) ?? 0) + delta);
  }

  const walletsWithBalance = wallets.map((w) => ({
    ...w,
    balance: Number(w.initial_balance) + (txDeltaByWallet.get(w.id) ?? 0),
  }));

  return (
    <WalletsShell
      wallets={walletsWithBalance}
      iconStyle={profile.icon_style ?? "3d"}
      currency={household?.currency ?? "IDR"}
    />
  );
}
