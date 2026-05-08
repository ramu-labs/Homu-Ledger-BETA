import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  // Pass <Database> so every `.from('table').select('column')` call is
  // checked against the live Postgres schema at compile time. Without
  // this the API silently returns zero rows when a column name is
  // misspelt — which is exactly how the M&D Members page stayed empty
  // while the data was right there in `household_members`.
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // Middleware handles refresh, so this is safe to swallow.
          }
        },
      },
    }
  );
}
