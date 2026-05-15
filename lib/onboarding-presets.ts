// Shared use-case + category presets for the v1.38.0 onboarding redesign.
//
// The flow asks the user what they'll use the ledger for, then shows a
// big expense-category picker with sensible defaults preselected based
// on that answer. Income and wallets get a fixed default seed (3 of
// each) — no picker, since the choices are pretty universal.
//
// One source of truth for both the initial-onboarding page and the
// "create new ledger" path from Settings → Ledger switcher (v1.38.1+).
//
// Adding a new use-case or category? Add the constant here and the
// rest of the app picks it up automatically — the picker reads
// EXPENSE_CATEGORY_MASTER, the use-case page reads USE_CASES, and the
// preselection logic just indexes USE_CASE_PRESELECTED_CATS by id.

export const USE_CASES = [
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    title: "Family",
    sub: "Shared household expenses with partner / kids",
  },
  {
    id: "personal",
    emoji: "🙋",
    title: "Personal",
    sub: "Just me, tracking day-to-day spending",
  },
  {
    id: "couple",
    emoji: "💑",
    title: "Couple",
    sub: "Shared with partner — no kids in the mix yet",
  },
  {
    id: "business",
    emoji: "💼",
    title: "Business",
    sub: "Track a small business or freelance practice",
  },
  {
    id: "side_hustle",
    emoji: "🚀",
    title: "Side hustle",
    sub: "Income and expenses for a side project",
  },
  {
    id: "travel",
    emoji: "✈️",
    title: "Travel / event",
    sub: "Track spending for a specific trip or event",
  },
] as const;

export type UseCaseId = (typeof USE_CASES)[number]["id"];

/** Identifier-keyed master list of expense categories the picker
 *  shows. The `id` is a stable string (used in preselection mapping +
 *  by the server when inserting). Symbol + colour mirror the format
 *  the existing `categories` table already uses. */
export type CategoryPreset = {
  id: string;
  name: string;
  symbol: string;
  color: string;
};

export const EXPENSE_CATEGORY_MASTER: CategoryPreset[] = [
  // Daily essentials
  { id: "groceries",      name: "Groceries",     symbol: "🛒", color: "#f97316" },
  { id: "dining",         name: "Dining out",    symbol: "🍽️", color: "#f97316" },
  { id: "coffee",         name: "Coffee & tea",  symbol: "☕", color: "#f59e0b" },
  // Transport
  { id: "transport",      name: "Transport",     symbol: "🚗", color: "#3b82f6" },
  { id: "fuel",           name: "Fuel",          symbol: "⛽", color: "#3b82f6" },
  // Home + bills
  { id: "housing",        name: "Housing",       symbol: "🏠", color: "#8b5cf6" },
  { id: "utilities",      name: "Utilities",     symbol: "💡", color: "#8b5cf6" },
  { id: "internet",       name: "Internet",      symbol: "📶", color: "#8b5cf6" },
  { id: "insurance",      name: "Insurance",     symbol: "🛡️", color: "#6b7280" },
  // Health
  { id: "healthcare",     name: "Healthcare",    symbol: "💊", color: "#ef4444" },
  { id: "fitness",        name: "Fitness",       symbol: "🏋️", color: "#14b8a6" },
  // Lifestyle
  { id: "shopping",       name: "Shopping",      symbol: "🛍️", color: "#ec4899" },
  { id: "entertainment",  name: "Entertainment", symbol: "🎬", color: "#eab308" },
  { id: "subscriptions",  name: "Subscriptions", symbol: "📺", color: "#eab308" },
  // Family / Kids
  { id: "kids",           name: "Kids",          symbol: "🧸", color: "#ec4899" },
  { id: "education",      name: "Education",     symbol: "📚", color: "#14b8a6" },
  { id: "pets",           name: "Pets",          symbol: "🐾", color: "#f59e0b" },
  // Travel & events
  { id: "travel",         name: "Travel",        symbol: "✈️", color: "#14b8a6" },
  { id: "lodging",        name: "Lodging",       symbol: "🏨", color: "#14b8a6" },
  { id: "activities",     name: "Activities",    symbol: "🎢", color: "#eab308" },
  // Business
  { id: "software",       name: "Software",      symbol: "💾", color: "#6b7280" },
  { id: "marketing",      name: "Marketing",     symbol: "📣", color: "#ec4899" },
  { id: "office",         name: "Office",        symbol: "📎", color: "#6b7280" },
  { id: "biz_meals",      name: "Meals (work)",  symbol: "🍱", color: "#f97316" },
  { id: "equipment",      name: "Equipment",     symbol: "🛠️", color: "#6b7280" },
  { id: "contractors",    name: "Contractors",   symbol: "👷", color: "#6b7280" },
  { id: "taxes",          name: "Taxes",         symbol: "📊", color: "#ef4444" },
  // Catch-all
  { id: "gifts",          name: "Gifts",         symbol: "🎁", color: "#ec4899" },
  { id: "other",          name: "Other",         symbol: "📋", color: "#6b7280" },
];

/** Which categories are preselected per use case. Tunable — these are
 *  starting points, the picker lets the user toggle any in/out before
 *  saving. Always include `other` so there's a catch-all from day one. */
export const USE_CASE_PRESELECTED_CATS: Record<UseCaseId, string[]> = {
  family: [
    "groceries", "dining", "transport", "utilities", "internet",
    "healthcare", "kids", "education", "insurance", "subscriptions", "other",
  ],
  personal: [
    "groceries", "dining", "coffee", "transport", "shopping",
    "entertainment", "healthcare", "subscriptions", "other",
  ],
  couple: [
    "groceries", "dining", "transport", "utilities", "entertainment",
    "travel", "shopping", "subscriptions", "other",
  ],
  business: [
    "software", "marketing", "office", "biz_meals", "equipment",
    "contractors", "travel", "taxes", "subscriptions", "other",
  ],
  side_hustle: [
    "software", "subscriptions", "marketing", "biz_meals", "equipment",
    "travel", "education", "other",
  ],
  travel: [
    "lodging", "dining", "transport", "activities", "shopping",
    "travel", "fuel", "other",
  ],
};

/** Fixed income categories every new ledger gets. No picker — these
 *  are universal enough that a multi-step income picker would be
 *  decision tax. User can add more later from Settings → Categories. */
export const DEFAULT_INCOME_CATEGORIES: CategoryPreset[] = [
  { id: "salary",  name: "Salary",  symbol: "💼", color: "#22c55e" },
  { id: "bonus",   name: "Bonus",   symbol: "🎁", color: "#eab308" },
  { id: "refund",  name: "Refund",  symbol: "💰", color: "#22c55e" },
];

/** Default wallets every new ledger gets. Same rationale as income —
 *  universal enough to skip the picker. */
export type WalletPreset = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  is_default?: boolean;
};
export const DEFAULT_WALLETS: WalletPreset[] = [
  { id: "cash",        name: "Cash",        symbol: "💵", color: "#22c55e", is_default: true },
  { id: "bank",        name: "Bank Card",   symbol: "💳", color: "#3b82f6" },
  { id: "credit_card", name: "Credit Card", symbol: "🏦", color: "#8b5cf6" },
];
