// Shared post-create wiring for a new household: wipe the trigger-
// seeded default categories, replace with the user's picked set
// (filtered against EXPENSE_CATEGORY_MASTER), seed the income +
// wallet defaults.
//
// Lives here (not inside an "use server" file) so both
// `createHousehold` (initial onboarding) and `createNewLedger`
// (Settings → New ledger, v1.38.1) can call it. Server-only because
// it takes the SSR Supabase client — never import from a Client
// Component.

import type { createClient } from "@/lib/supabase/server";
import {
  EXPENSE_CATEGORY_MASTER,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_WALLETS,
} from "@/lib/onboarding-presets";

/**
 * Replace the trigger-seeded default categories with the user-picked
 * set, AND seed the 3 default income categories + 3 default wallets.
 * Called from both the onboarding flow and the new-ledger flow.
 *
 * The seed_default_categories trigger fires on household insert and
 * creates 11 expense + income categories with is_default=true. We
 * DELETE all of those and INSERT what the user actually picked. The
 * user's own categories (created later via Settings → Categories)
 * are is_default=false so they survive.
 */
export async function applyHouseholdPresets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  selectedCategoryIds: string[]
): Promise<void> {
  // 1. Wipe whatever the seed_default_categories trigger created.
  await supabase
    .from("categories")
    .delete()
    .eq("household_id", householdId)
    .eq("is_default", true);

  // 2. Insert chosen expense categories (filtered against the master,
  //    so a malicious / stale id from the client can't sneak in).
  const chosenExpense = EXPENSE_CATEGORY_MASTER.filter((c) =>
    selectedCategoryIds.includes(c.id)
  );
  if (chosenExpense.length > 0) {
    await supabase.from("categories").insert(
      chosenExpense.map((c) => ({
        household_id: householdId,
        name: c.name,
        symbol: c.symbol,
        color: c.color,
        is_default: true,
        type: "expense" as const,
      }))
    );
  }

  // 3. Insert the 3 default income categories (always — no picker).
  await supabase.from("categories").insert(
    DEFAULT_INCOME_CATEGORIES.map((c) => ({
      household_id: householdId,
      name: c.name,
      symbol: c.symbol,
      color: c.color,
      is_default: true,
      type: "income" as const,
    }))
  );

  // 4. Insert the 3 default wallets. The trigger doesn't seed wallets
  //    at all, so this is a fresh insert. One is_default=true so the
  //    Add Transaction sheet preselects it.
  await supabase.from("wallets").insert(
    DEFAULT_WALLETS.map((w) => ({
      household_id: householdId,
      name: w.name,
      symbol: w.symbol,
      color: w.color,
      initial_balance: 0,
      is_default: w.is_default ?? false,
    }))
  );
}
