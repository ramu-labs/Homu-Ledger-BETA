import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cursor-paginated transactions endpoint. The transactions page server-renders
 * only the first ~200 rows; the client calls this when the user scrolls past
 * the cached set to fetch older batches.
 *
 * Cursor format mirrors the page's ORDER BY: `date DESC, created_at DESC, id DESC`.
 * Pass the LAST visible row's (date, createdAt, id) to get rows strictly older
 * than that one. With no cursor we return the most recent `limit` rows.
 *
 *   GET /api/transactions?date=2026-05-08&createdAt=2026-05-08T03:14:15Z&id=...&limit=20
 *
 * RLS handles authorization: the caller's session cookie is attached, and the
 * "transactions: members can read" policy filters to their household. No need
 * to re-check household_id server-side.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const createdAt = searchParams.get("createdAt");
  const id = searchParams.get("id");
  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);

  let query = supabase
    .from("transactions")
    .select("id, type, amount, name, category_id, wallet_id, transfer_pair_id, recurring_item_id, date, created_by, created_at, photo_url, categories(id, name, symbol, color, type), wallets(id, name, symbol, color, initial_balance, is_default)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  // Composite cursor: rows strictly "less than" (date, createdAt, id) in the
  // ORDER BY tuple sense. Translates to:
  //   date < D
  //   OR (date = D AND created_at < CA)
  //   OR (date = D AND created_at = CA AND id < I)
  if (date && createdAt && id) {
    query = query.or(
      `date.lt.${date},and(date.eq.${date},created_at.lt.${createdAt}),and(date.eq.${date},created_at.eq.${createdAt},id.lt.${id})`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data ?? [] });
}
