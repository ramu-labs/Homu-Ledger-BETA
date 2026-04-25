import {
  Home,
  House,
  Car,
  Bus,
  Plane,
  Train,
  Fuel,
  UtensilsCrossed,
  Pizza,
  Soup,
  Coffee,
  ShoppingCart,
  ShoppingBag,
  Shirt,
  Pill,
  Stethoscope,
  HeartPulse,
  Dumbbell,
  BookOpen,
  GraduationCap,
  Film,
  Gamepad2,
  Music,
  Briefcase,
  Wallet,
  Landmark,
  Receipt,
  Gift,
  PawPrint,
  Baby,
  Leaf,
  Zap,
  Wrench,
  Scissors,
  Smartphone,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";

export type IconStyle = "2d" | "3d";

/** Curated Lucide icons for category picker. id = key stored as `lu:<id>` in DB. */
export const CATEGORY_LUCIDE_ICONS: { id: string; icon: LucideIcon }[] = [
  { id: "home", icon: Home },
  { id: "house", icon: House },
  { id: "car", icon: Car },
  { id: "bus", icon: Bus },
  { id: "plane", icon: Plane },
  { id: "train", icon: Train },
  { id: "fuel", icon: Fuel },
  { id: "utensils-crossed", icon: UtensilsCrossed },
  { id: "pizza", icon: Pizza },
  { id: "soup", icon: Soup },
  { id: "coffee", icon: Coffee },
  { id: "shopping-cart", icon: ShoppingCart },
  { id: "shopping-bag", icon: ShoppingBag },
  { id: "shirt", icon: Shirt },
  { id: "pill", icon: Pill },
  { id: "stethoscope", icon: Stethoscope },
  { id: "heart-pulse", icon: HeartPulse },
  { id: "dumbbell", icon: Dumbbell },
  { id: "book-open", icon: BookOpen },
  { id: "graduation-cap", icon: GraduationCap },
  { id: "film", icon: Film },
  { id: "gamepad-2", icon: Gamepad2 },
  { id: "music", icon: Music },
  { id: "briefcase", icon: Briefcase },
  { id: "wallet", icon: Wallet },
  { id: "landmark", icon: Landmark },
  { id: "receipt", icon: Receipt },
  { id: "gift", icon: Gift },
  { id: "paw-print", icon: PawPrint },
  { id: "baby", icon: Baby },
  { id: "leaf", icon: Leaf },
  { id: "zap", icon: Zap },
  { id: "wrench", icon: Wrench },
  { id: "scissors", icon: Scissors },
  { id: "smartphone", icon: Smartphone },
  { id: "lightbulb", icon: Lightbulb },
];

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_LUCIDE_ICONS.map((e) => [e.id, e.icon]),
);

export const LUCIDE_SYMBOL_PREFIX = "lu:";

/** "lu:home" → Lucide Home component, or null if not found */
export function resolveLucideIcon(symbol: string | null | undefined): LucideIcon | null {
  if (!symbol?.startsWith(LUCIDE_SYMBOL_PREFIX)) return null;
  return LUCIDE_ICON_MAP[symbol.slice(LUCIDE_SYMBOL_PREFIX.length)] ?? null;
}

export function isLucideSymbol(symbol: string | null | undefined): boolean {
  return !!symbol && symbol.startsWith(LUCIDE_SYMBOL_PREFIX);
}

export function makeLucideSymbol(id: string): string {
  return `${LUCIDE_SYMBOL_PREFIX}${id}`;
}

// ---------------------------------------------------------------------------
// Bidirectional emoji ↔ lucide mapping (for the global icon-style setting)
// ---------------------------------------------------------------------------

/** Maps an emoji to its closest Lucide icon id. */
export const EMOJI_TO_LUCIDE: Record<string, string> = {
  // Housing / transport
  "🏠": "home",
  "🏡": "house",
  "🚗": "car",
  "🚙": "car",
  "🚌": "bus",
  "✈️": "plane",
  "🚂": "train",
  "⛽": "fuel",
  // Food & drink
  "🍔": "utensils-crossed",
  "🍽️": "utensils-crossed",
  "🍕": "pizza",
  "🍜": "soup",
  "🍲": "soup",
  "☕": "coffee",
  "🛒": "shopping-cart",
  // Clothing
  "👕": "shirt",
  "👗": "shirt",
  // Health
  "💊": "pill",
  "🧴": "pill",
  "🩺": "stethoscope",
  "🏥": "stethoscope",
  "❤️": "heart-pulse",
  "🏋️": "dumbbell",
  "💪": "dumbbell",
  // Education
  "📚": "book-open",
  "🎓": "graduation-cap",
  // Entertainment
  "🎬": "film",
  "🎮": "gamepad-2",
  "🎵": "music",
  "🎶": "music",
  // Work & finance
  "💼": "briefcase",
  "💰": "wallet",
  "💳": "wallet",
  "🏦": "landmark",
  "🌐": "landmark",
  "🧾": "receipt",
  "📋": "receipt",
  // Misc
  "🎁": "gift",
  "🐾": "paw-print",
  "👶": "baby",
  "🌿": "leaf",
  "⚡": "zap",
  "🔧": "wrench",
  "🧹": "wrench",
  "✂️": "scissors",
  "📱": "smartphone",
  "💡": "lightbulb",
};

/**
 * Reverse map: lucide id → the "best" emoji.
 * (Derived from EMOJI_TO_LUCIDE — last emoji wins for duplicates, but the
 * important defaults all map cleanly.)
 */
export const LUCIDE_TO_EMOJI: Record<string, string> = {};
// Build reverse map — prefer the first occurrence for each lucide id
for (const [emoji, id] of Object.entries(EMOJI_TO_LUCIDE)) {
  if (!(id in LUCIDE_TO_EMOJI)) {
    LUCIDE_TO_EMOJI[id] = emoji;
  }
}
