import { createClient } from "@/lib/supabase/client";

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Upload a transaction photo directly from the browser to Supabase Storage.
 *
 * Why client-side instead of relaying through a Next.js server action:
 *   1. Vercel server actions cap the request body at 4.5 MB (Hobby plan).
 *      iPhone photos routinely exceed that, which causes the action to hang
 *      or 413 — the user's UI stays stuck on "Saving…" forever.
 *   2. Even when the file fits, the relay path is browser → Vercel → Supabase
 *      (two hops over the same bytes). Direct browser → Supabase is one hop,
 *      and crucially, the iOS-Chrome-on-5G case stops timing out.
 *   3. We can give the upload its own try/catch and timeout so a flaky network
 *      surfaces as a real error message instead of a frozen button.
 *
 * The bucket is private. Storage policies allow authenticated members to
 * upload only below their ledger folder (`<householdId>/...`). The app stores
 * the storage object path, then server-rendered pages create short-lived signed
 * URLs for display.
 */
export async function uploadTransactionPhoto(
  householdId: string,
  file: File,
  timeoutMs = 30_000,
): Promise<UploadResult> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${householdId}/${crypto.randomUUID()}.${ext}`;

  // Race the upload against an explicit timeout so a stalled connection
  // doesn't leave the UI in limbo. 30s is generous for ~10 MB photos on 4G.
  const uploadPromise = supabase.storage
    .from("transaction-photos")
    .upload(path, file, { contentType: file.type, upsert: false });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Upload timed out — check your connection and try again.")),
      timeoutMs,
    );
  });

  try {
    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Upload failed — no data returned." };
    return { ok: true, path: data.path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}
