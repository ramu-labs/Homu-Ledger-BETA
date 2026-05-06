import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoriesShell from "@/components/categories-shell";
import type { DbCategory } from "@/lib/types";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id, icon_style")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) redirect("/onboarding");

  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id, name, symbol, color, is_default")
    .eq("household_id", profile.household_id)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  const categories: DbCategory[] = categoriesRaw ?? [];

  return <CategoriesShell categories={categories} iconStyle={profile.icon_style ?? "3d"} />;
}
