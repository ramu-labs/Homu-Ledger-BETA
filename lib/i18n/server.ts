import { createClient } from "@/lib/supabase/server";
import { getT, type Lang } from "./dictionaries";

/**
 * Server-side translation helper. Reads the current user's language preference
 * from their profile and returns a t() function for that language.
 * Falls back to English if not authenticated or no preference set.
 */
export async function getServerT() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let lang: Lang = "en";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", user.id)
      .single();
    lang = (profile?.language as Lang) ?? "en";
  }
  return { t: getT(lang), lang };
}
