import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role Supabase client. Bypasses RLS and grant checks — only call from
 * trusted server actions (never imported by client code, no cookies attached).
 *
 * Used for the small set of RPCs that must run before a user is logged in
 * (sign-up promo-code validation, username → email lookup). After migration
 * 0012 those RPCs are no longer granted to `anon`, so anonymous PostgREST
 * clients can't probe them. Server actions reach them through this admin
 * client instead.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the deployment env. If missing, calls
 * to `getAdminClient()` throw on first use so the misconfig is loud.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it in Vercel → Project → Settings → Environment Variables (Production + Preview), then redeploy."
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
