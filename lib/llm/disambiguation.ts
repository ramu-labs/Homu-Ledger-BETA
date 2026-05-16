// Disambiguation rules for category auto-suggestion.
//
// Some transaction descriptions match keywords in more than one
// category. "ayam goreng" looks like Groceries (ayam = chicken) but is
// really Dining out (goreng = a cooked dish). "ayam 500g" is the
// opposite — raw chicken sold by weight, i.e. Groceries.
//
// These regex rules run BEFORE the keyword-cache lookup in
// suggestCategory(). When a rule fires it FORCES a category name; the
// caller resolves that name against the household's actual categories
// and, if the household has it, returns immediately (skipping the cache
// and the AI). If the household doesn't have that category, the forced
// result is discarded and the normal lookup proceeds — so a rule can
// never produce a category the user doesn't own.
//
// Rules are expense-only. Income descriptions skip this layer entirely.
//
// Order matters: the FIRST matching rule wins. The ordering encodes
// precedence — e.g. "kado parfum" is a Gift, not Personal care, so the
// gift rule sits above everything else.

export type DisambiguationResult = {
  /** Category NAME (matches the v1.40.1 default set). Caller resolves
   *  it against the household's categories. */
  categoryName: string;
  /** Which rule fired — surfaced in logs / the dev panel. */
  ruleId: string;
};

// Cooking-method words → the noun is a prepared dish, not a raw input.
const PREPARED_RE =
  /\b(goreng|bakar|rebus|panggang|tumis|kukus|geprek|penyet|fried|grilled|roasted|boiled|steamed|crispy)\b/;

// Quantity + weight/volume/count unit → bought raw/bulk → Groceries.
const WEIGHT_UNIT_RE =
  /\b\d+\s*(g|gr|gram|kg|kilo|kilogram|ml|liter|l|cl|oz|lb|pcs|biji|butir|sisir|ikat|ekor|bungkus|pack|sachet|dus|botol|kaleng)\b/;

// Fuel station / fuel product tokens → Fuel (beats Transport).
const FUEL_RE =
  /\b(bensin|pertalite|pertamax|pertamax turbo|solar|dexlite|biosolar|spbu|petrol|gasoline|diesel|fill ?up)\b/;

// Gift markers → Gifts (override the underlying product category).
const GIFT_RE =
  /\b(kado|hadiah|gift|present|hampers|parsel|parcel|bingkisan)\b/;

// Subscription-period markers → Subscriptions …
const SUBSCRIPTION_RE =
  /\b(langganan|berlangganan|subscription|subscribe|monthly sub|bulanan|annual sub|tahunan)\b/;
// … EXCEPT when the thing subscribed is a utility or telco, which keep
// their own category ("langganan listrik" → Utilities, not Subscriptions).
const UTILITY_TELCO_RE =
  /\b(listrik|pln|air|pdam|gas|indihome|biznet|wifi|internet|telkom|telkomsel|xl|indosat|smartfren|tri|axis|first media|myrepublic|iconnet)\b/;

// Romantic-partner markers paired with an outing → Date nights.
const DATE_NIGHT_RE =
  /\b(date night|datenight|ngedate|anniversary|anniversaire|valentine|valentinan|sama pacar|sama suami|sama istri|with bf|with gf|with hubby|with wifey)\b/;

// Baby-specific items → Baby. Checked before the kids tokens.
const BABY_RE =
  /\b(popok|diaper|nappy|formula|sufor|mpasi|asi|bedong|stroller|botol susu|dot bayi|empeng|baby|bayi|newborn)\b/;
// School-age cues → Kids.
const KIDS_RE =
  /\b(seragam|tas sekolah|crayon|mainan anak|sepeda anak|skuter anak|les anak|uniform)\b/;

/**
 * Run the disambiguation rules over a description.
 *
 * @param rawDescription the user's typed description (any casing)
 * @param type           transaction type — rules are expense-only
 * @returns the forced category + rule id, or null if no rule fires
 */
export function disambiguate(
  rawDescription: string,
  type: "income" | "expense"
): DisambiguationResult | null {
  if (type !== "expense") return null;
  const text = rawDescription.toLowerCase();
  if (!text.trim()) return null;

  // 1. Gift markers win over everything — "kado parfum" is a Gift.
  if (GIFT_RE.test(text)) {
    return { categoryName: "Gifts", ruleId: "gift-vs-shopping" };
  }

  // 2. Romantic outing → Date nights (beats Dining out / Entertainment).
  if (DATE_NIGHT_RE.test(text)) {
    return { categoryName: "Date nights", ruleId: "date-night-pattern" };
  }

  // 3. Fuel tokens → Fuel (beats Transport).
  if (FUEL_RE.test(text)) {
    return { categoryName: "Fuel", ruleId: "fuel-vs-transport" };
  }

  // 4. Cooking-method word → a prepared dish → Dining out. Checked
  //    before the weight-unit rule so "ayam goreng 500g" stays Dining
  //    out — the cooking word is the stronger signal.
  if (PREPARED_RE.test(text)) {
    return { categoryName: "Dining out", ruleId: "prepared-prefix-bias" };
  }

  // 5. Quantity + unit → raw/bulk purchase → Groceries. This is what
  //    splits "ayam 500g" (Groceries) from a bare "ayam goreng".
  if (WEIGHT_UNIT_RE.test(text)) {
    return { categoryName: "Groceries", ruleId: "weight-unit-bias" };
  }

  // 6. Subscription markers → Subscriptions, unless the subscribed
  //    thing is a utility/telco (those keep their own category).
  if (SUBSCRIPTION_RE.test(text) && !UTILITY_TELCO_RE.test(text)) {
    return { categoryName: "Subscriptions", ruleId: "subscription-pattern" };
  }

  // 7. Baby items → Baby; school-age cues → Kids.
  if (BABY_RE.test(text)) {
    return { categoryName: "Baby", ruleId: "kids-vs-baby" };
  }
  if (KIDS_RE.test(text)) {
    return { categoryName: "Kids", ruleId: "kids-vs-baby" };
  }

  return null;
}
