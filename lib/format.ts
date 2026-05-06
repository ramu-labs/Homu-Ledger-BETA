import { getCurrency } from "./currencies";

export function formatAmount(amount: number, currencyCode: string = "IDR"): string {
  const cur = getCurrency(currencyCode);
  const rounded = Math.round(Math.abs(amount));
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, cur.separator);
  return cur.spaceBefore ? `${cur.symbol} ${formatted}` : `${cur.symbol}${formatted}`;
}

export function formatAmountSigned(amount: number, type: "income" | "expense", currencyCode: string = "IDR"): string {
  const sign = type === "income" ? "+" : "-";
  return `${sign}${formatAmount(amount, currencyCode)}`;
}

// Backward-compatible aliases (default IDR)
export function formatIDR(amount: number): string { return formatAmount(amount, "IDR"); }
export function formatIDRSigned(amount: number, type: "income" | "expense"): string {
  return formatAmountSigned(amount, type, "IDR");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format a YYYY-MM-DD date as a short label.
 * Pass `todayKey` (also "YYYY-MM-DD") so the "Today" decision is deterministic
 * across SSR and client (otherwise `new Date()` mismatches between UTC server
 * and the user's local timezone, causing hydration errors).
 * If `todayKey` is null/undefined the function never returns "Today".
 */
export function formatShortDate(date: string, todayKey?: string | null): string {
  const [y, m, d] = date.split("-").map(Number);
  if (todayKey && todayKey === date) return "Today";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
