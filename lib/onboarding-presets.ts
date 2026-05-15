// Per-use-case onboarding presets (v1.40.0 redesign).
//
// Previously (v1.38.0) there was ONE shared expense-category master
// list with preselection per use case. That meant a "Family" picker
// showed "Office supplies" greyed out, and a "Business" picker showed
// "Kids" greyed out. Users found that confusing.
//
// v1.40.0 changes the data model: each use case has its OWN
// extensive category list, tailored to that scenario. The picker
// renders only the categories relevant to the chosen use case.
// `USE_CASE_PRESELECTED_CATS` is still a subset of those — what's
// auto-ticked when the picker opens; everything else in the list is
// available but unticked.
//
// Adding a new category? Drop it into the case's array, AND (if it
// matters for the server-side validation) into ALL_CATEGORY_IDS via
// the auto-derived union below.

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

export type CategoryPreset = {
  id: string;
  name: string;
  symbol: string;
  color: string;
};

// ── Per-use-case category lists ─────────────────────────────────────
// v1.40.1: every case has EXACTLY 16 categories and EXACTLY 8
// preselected. 16 fits comfortably in a two-column 8-row picker grid
// on mobile without scrolling, and 8 preselected feels "set up for
// me" without overwhelming the empty-state ledger with rows the user
// has to delete. Items are ordered roughly by frequency-of-use so the
// most-needed sit at the top of the picker.
//
// NOTE on stable ids: ids are case-specific where the SAME concept
// has a different name per context (e.g. "office_supplies" only in
// business). Where a concept is universal (groceries, transport,
// other), the id is shared so server-side dedupe stays cheap.

const FAMILY_CATEGORIES: CategoryPreset[] = [
  { id: "groceries",         name: "Groceries",         symbol: "🛒", color: "#f97316" },
  { id: "dining",            name: "Dining out",        symbol: "🍽️", color: "#f97316" },
  { id: "coffee",            name: "Coffee & tea",      symbol: "☕", color: "#f59e0b" },
  { id: "transport",         name: "Transport",         symbol: "🚗", color: "#3b82f6" },
  { id: "fuel",              name: "Fuel",              symbol: "⛽", color: "#3b82f6" },
  { id: "housing",           name: "Housing",           symbol: "🏠", color: "#8b5cf6" },
  { id: "utilities",         name: "Utilities",         symbol: "💡", color: "#8b5cf6" },
  { id: "internet",          name: "Internet",          symbol: "📶", color: "#8b5cf6" },
  { id: "healthcare",        name: "Healthcare",        symbol: "💊", color: "#ef4444" },
  { id: "kids",              name: "Kids",              symbol: "🧸", color: "#ec4899" },
  { id: "baby",              name: "Baby",              symbol: "👶", color: "#ec4899" },
  { id: "daycare",           name: "Daycare",           symbol: "🏫", color: "#14b8a6" },
  { id: "school_fees",       name: "School fees",       symbol: "🎒", color: "#14b8a6" },
  { id: "entertainment",     name: "Entertainment",     symbol: "🎬", color: "#eab308" },
  { id: "subscriptions",     name: "Subscriptions",     symbol: "📺", color: "#eab308" },
  { id: "other",             name: "Other",             symbol: "📋", color: "#6b7280" },
];

const PERSONAL_CATEGORIES: CategoryPreset[] = [
  { id: "groceries",       name: "Groceries",      symbol: "🛒", color: "#f97316" },
  { id: "dining",          name: "Dining out",     symbol: "🍽️", color: "#f97316" },
  { id: "coffee",          name: "Coffee & tea",   symbol: "☕", color: "#f59e0b" },
  { id: "transport",       name: "Transport",      symbol: "🚗", color: "#3b82f6" },
  { id: "fuel",            name: "Fuel",           symbol: "⛽", color: "#3b82f6" },
  { id: "housing",         name: "Housing",        symbol: "🏠", color: "#8b5cf6" },
  { id: "healthcare",      name: "Healthcare",     symbol: "💊", color: "#ef4444" },
  { id: "fitness",         name: "Fitness",        symbol: "🏋️", color: "#14b8a6" },
  { id: "personal_care",   name: "Personal care",  symbol: "🧴", color: "#ec4899" },
  { id: "shopping",        name: "Shopping",       symbol: "🛍️", color: "#ec4899" },
  { id: "clothing",        name: "Clothing",       symbol: "👕", color: "#ec4899" },
  { id: "entertainment",   name: "Entertainment",  symbol: "🎬", color: "#eab308" },
  { id: "subscriptions",   name: "Subscriptions",  symbol: "📺", color: "#eab308" },
  { id: "hobbies",         name: "Hobbies",        symbol: "🎨", color: "#14b8a6" },
  { id: "gifts",           name: "Gifts",          symbol: "🎁", color: "#ec4899" },
  { id: "other",           name: "Other",          symbol: "📋", color: "#6b7280" },
];

const COUPLE_CATEGORIES: CategoryPreset[] = [
  { id: "groceries",       name: "Groceries",      symbol: "🛒", color: "#f97316" },
  { id: "dining",          name: "Dining out",     symbol: "🍽️", color: "#f97316" },
  { id: "coffee",          name: "Coffee & tea",   symbol: "☕", color: "#f59e0b" },
  { id: "transport",       name: "Transport",      symbol: "🚗", color: "#3b82f6" },
  { id: "fuel",            name: "Fuel",           symbol: "⛽", color: "#3b82f6" },
  { id: "housing",         name: "Housing",        symbol: "🏠", color: "#8b5cf6" },
  { id: "utilities",       name: "Utilities",      symbol: "💡", color: "#8b5cf6" },
  { id: "internet",        name: "Internet",       symbol: "📶", color: "#8b5cf6" },
  { id: "subscriptions",   name: "Subscriptions",  symbol: "📺", color: "#eab308" },
  { id: "date_nights",     name: "Date nights",    symbol: "🌹", color: "#ec4899" },
  { id: "entertainment",   name: "Entertainment",  symbol: "🎬", color: "#eab308" },
  { id: "travel",          name: "Travel",         symbol: "✈️", color: "#14b8a6" },
  { id: "healthcare",      name: "Healthcare",     symbol: "💊", color: "#ef4444" },
  { id: "shopping",        name: "Shopping",       symbol: "🛍️", color: "#ec4899" },
  { id: "gifts",           name: "Gifts",          symbol: "🎁", color: "#ec4899" },
  { id: "other",           name: "Other",          symbol: "📋", color: "#6b7280" },
];

const BUSINESS_CATEGORIES: CategoryPreset[] = [
  { id: "office_supplies", name: "Office supplies", symbol: "📎", color: "#6b7280" },
  { id: "equipment",       name: "Equipment",       symbol: "🛠️", color: "#6b7280" },
  { id: "software",        name: "Software",        symbol: "💾", color: "#3b82f6" },
  { id: "subscriptions",   name: "Subscriptions",   symbol: "📺", color: "#eab308" },
  { id: "hosting",         name: "Hosting & domains",symbol: "🌐", color: "#3b82f6" },
  { id: "marketing",       name: "Marketing",       symbol: "📣", color: "#ec4899" },
  { id: "advertising",     name: "Advertising",     symbol: "📰", color: "#ec4899" },
  { id: "biz_travel",      name: "Travel (business)",symbol: "✈️", color: "#14b8a6" },
  { id: "biz_meals",       name: "Meals (business)", symbol: "🍱", color: "#f97316" },
  { id: "contractors",     name: "Contractors",     symbol: "👷", color: "#6b7280" },
  { id: "payroll",         name: "Payroll",         symbol: "💸", color: "#ef4444" },
  { id: "legal",           name: "Legal",           symbol: "⚖️", color: "#6b7280" },
  { id: "accounting",      name: "Accounting",      symbol: "🧾", color: "#6b7280" },
  { id: "taxes",           name: "Taxes",           symbol: "📊", color: "#ef4444" },
  { id: "bank_fees",       name: "Bank fees",       symbol: "🏦", color: "#6b7280" },
  { id: "other",           name: "Other",           symbol: "📋", color: "#6b7280" },
];

const SIDE_HUSTLE_CATEGORIES: CategoryPreset[] = [
  { id: "software",        name: "Software",         symbol: "💾", color: "#3b82f6" },
  { id: "subscriptions",   name: "Subscriptions",    symbol: "📺", color: "#eab308" },
  { id: "hosting",         name: "Hosting & domains",symbol: "🌐", color: "#3b82f6" },
  { id: "equipment",       name: "Equipment",        symbol: "🛠️", color: "#6b7280" },
  { id: "marketing",       name: "Marketing",        symbol: "📣", color: "#ec4899" },
  { id: "advertising",     name: "Advertising",      symbol: "📰", color: "#ec4899" },
  { id: "biz_meals",       name: "Meals (work)",     symbol: "🍱", color: "#f97316" },
  { id: "biz_travel",      name: "Travel (work)",    symbol: "✈️", color: "#14b8a6" },
  { id: "training",        name: "Courses & training",symbol: "📚", color: "#14b8a6" },
  { id: "home_office",     name: "Home office",      symbol: "🪑", color: "#8b5cf6" },
  { id: "contractors",     name: "Contractors",      symbol: "👷", color: "#6b7280" },
  { id: "accounting",      name: "Accounting",       symbol: "🧾", color: "#6b7280" },
  { id: "payment_fees",    name: "Payment fees",     symbol: "💳", color: "#6b7280" },
  { id: "bank_fees",       name: "Bank fees",        symbol: "🏦", color: "#6b7280" },
  { id: "taxes",           name: "Taxes",            symbol: "📊", color: "#ef4444" },
  { id: "other",           name: "Other",            symbol: "📋", color: "#6b7280" },
];

const TRAVEL_CATEGORIES: CategoryPreset[] = [
  { id: "lodging",         name: "Lodging",          symbol: "🏨", color: "#14b8a6" },
  { id: "flights",         name: "Flights",          symbol: "✈️", color: "#14b8a6" },
  { id: "ground_transport",name: "Ground transport", symbol: "🚆", color: "#3b82f6" },
  { id: "ride_share",      name: "Ride share / taxi",symbol: "🚕", color: "#3b82f6" },
  { id: "food_dining",     name: "Food & dining",    symbol: "🍽️", color: "#f97316" },
  { id: "snacks",          name: "Snacks",           symbol: "🍿", color: "#f97316" },
  { id: "coffee",          name: "Coffee & tea",     symbol: "☕", color: "#f59e0b" },
  { id: "activities",      name: "Activities",       symbol: "🎢", color: "#eab308" },
  { id: "tours",           name: "Tours",            symbol: "🗺️", color: "#eab308" },
  { id: "souvenirs",       name: "Souvenirs",        symbol: "🛍️", color: "#ec4899" },
  { id: "shopping",        name: "Shopping",         symbol: "🛒", color: "#ec4899" },
  { id: "gifts",           name: "Gifts",            symbol: "🎁", color: "#ec4899" },
  { id: "tips",            name: "Tips",             symbol: "💵", color: "#22c55e" },
  { id: "travel_insurance",name: "Travel insurance", symbol: "🛡️", color: "#6b7280" },
  { id: "visas",           name: "Visas & permits",  symbol: "🛂", color: "#6b7280" },
  { id: "other",           name: "Other",            symbol: "📋", color: "#6b7280" },
];

/** Per-use-case category catalogue — what the picker shows. */
export const USE_CASE_CATEGORIES: Record<UseCaseId, CategoryPreset[]> = {
  family: FAMILY_CATEGORIES,
  personal: PERSONAL_CATEGORIES,
  couple: COUPLE_CATEGORIES,
  business: BUSINESS_CATEGORIES,
  side_hustle: SIDE_HUSTLE_CATEGORIES,
  travel: TRAVEL_CATEGORIES,
};

/** Which category ids are PRESELECTED in the picker for each case.
 *  v1.40.1: exactly 8 per case. Always a subset of the case's
 *  USE_CASE_CATEGORIES list. "other" is always included as the
 *  catch-all so the user has a safe bucket from minute one. */
export const USE_CASE_PRESELECTED_CATS: Record<UseCaseId, string[]> = {
  family: ["groceries","dining","transport","utilities","healthcare","kids","subscriptions","other"],
  personal: ["groceries","dining","coffee","transport","healthcare","shopping","subscriptions","other"],
  couple: ["groceries","dining","transport","utilities","subscriptions","date_nights","entertainment","other"],
  business: ["office_supplies","software","subscriptions","biz_meals","biz_travel","contractors","accounting","other"],
  side_hustle: ["software","subscriptions","hosting","equipment","marketing","training","payment_fees","other"],
  travel: ["lodging","flights","ground_transport","ride_share","food_dining","activities","tours","other"],
};

/** Deduplicated union of every category id that COULD be picked
 *  from any use case. Used server-side by applyHouseholdPresets to
 *  filter stale / malicious ids from the client out before INSERT. */
const _ALL_BY_ID = new Map<string, CategoryPreset>();
for (const list of Object.values(USE_CASE_CATEGORIES)) {
  for (const c of list) {
    // First-write-wins — the few cases that share an id (groceries
    // appears in family + personal + couple) have identical name /
    // symbol / colour across all of them, so this is fine.
    if (!_ALL_BY_ID.has(c.id)) _ALL_BY_ID.set(c.id, c);
  }
}
/** Legacy export name kept for backwards-compat with consumers that
 *  reference the v1.38.0 shared master. Now derived from the
 *  per-case lists above. */
export const EXPENSE_CATEGORY_MASTER: CategoryPreset[] = Array.from(_ALL_BY_ID.values());

/** Fixed income categories every new ledger gets. No picker. */
export const DEFAULT_INCOME_CATEGORIES: CategoryPreset[] = [
  { id: "salary",  name: "Salary",  symbol: "💼", color: "#22c55e" },
  { id: "bonus",   name: "Bonus",   symbol: "🎁", color: "#eab308" },
  { id: "refund",  name: "Refund",  symbol: "💰", color: "#22c55e" },
];

/** Default wallets every new ledger gets. */
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
