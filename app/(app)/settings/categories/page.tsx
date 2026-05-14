import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import CategoriesShell from "@/components/categories-shell";
import type { DbCategory } from "@/lib/types";

export default async function CategoriesPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.household_id) redirect("/onboarding");

  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name, symbol, color, type, is_default")
    .eq("household_id", profile.household_id)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  const categories: DbCategory[] = categoriesRaw ?? [];

  return <CategoriesShell categories={categories} iconStyle={profile.icon_style ?? "3d"} />;
}
