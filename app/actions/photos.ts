"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign a transaction-photo storage path on demand. Used by the edit sheet
 * when a user opens a row that already has a saved photo — we sign one URL
 * instead of pre-signing every photo on every page load (which was an
 * N×100ms storage round-trip on the transactions page).
 *
 * The bucket is private (migration 0011); only members of the photo's
 * household can read it (RLS via can_access_transaction_photo).
 */
export async function signTransactionPhoto(path: string): Promise<{ url?: string; error?: string }> {
  if (!path) return { error: "No path supplied" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Photos may have been written historically as a public URL. Strip the
  // public-URL prefix if present so we always pass a bare object key.
  const publicPrefix = "/storage/v1/object/public/transaction-photos/";
  const idx = path.indexOf(publicPrefix);
  const objectPath = idx === -1 ? path : decodeURIComponent(path.slice(idx + publicPrefix.length));

  const { data, error } = await supabase.storage
    .from("transaction-photos")
    .createSignedUrl(objectPath, 60 * 60);

  if (error) return { error: error.message };
  return { url: data?.signedUrl ?? undefined };
}
