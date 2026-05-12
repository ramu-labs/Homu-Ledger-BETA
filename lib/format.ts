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

/** Like formatAmount, but preserves the natural sign of the number.
 *  Use this for balances (which can be negative); use formatAmountSigned for
 *  individual transactions where the sign is driven by income/expense type.
 */
export function formatAmountWithSign(amount: number, currencyCode: string = "IDR"): string {
  const formatted = formatAmount(amount, currencyCode);
  return amount < 0 ? `-${formatted}` : formatted;
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

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Format "YYYY-MM-DD" as "Mon, 11 May 2026". Used by the daily-trend
 * chart tooltip. Computes the weekday in local time using the parsed
 * components (Date.parse on a bare YYYY-MM-DD interprets it as UTC,
 * which can yield the wrong weekday in negative-UTC-offset timezones).
 */
export function formatDayWithWeekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const local = new Date(y, m - 1, d);
  return `${DAYS_SHORT[local.getDay()]}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/**
 * Group-header label for a YYYY-MM-DD date in the transaction list.
 * Today → "Today". Same calendar year → "Mon, 11 May". Older → "Mon, 11 May 2025".
 * Pass `todayKey` for the SSR-safe "Today" decision (see formatShortDate).
 */
export function formatDayGroup(date: string, todayKey?: string | null): string {
  if (todayKey && todayKey === date) return "Today";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const local = new Date(y, m - 1, d);
  const weekday = DAYS_SHORT[local.getDay()];
  const month = MONTHS_SHORT[m - 1];
  const currentYear = new Date().getFullYear();
  return y === currentYear
    ? `${weekday}, ${d} ${month}`
    : `${weekday}, ${d} ${month} ${y}`;
}

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
