import {
  Home,
  House,
  Car,
  Bus,
  Plane,
  Train,
  UtensilsCrossed,
  Pizza,
  Soup,
  Coffee,
  ShoppingCart,
  Shirt,
  Pill,
  Dumbbell,
  BookOpen,
  Film,
  Gamepad2,
  Music,
  Briefcase,
  Wallet,
  Landmark,
  Gift,
  PawPrint,
  Leaf,
  Zap,
  Wrench,
  Smartphone,
  HeartPulse,
  GraduationCap,
  Lightbulb,
  Receipt,
  Fuel,
  Baby,
  Stethoscope,
  Scissors,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated set of Lucide icons usable as category symbols.
 * The key becomes the stored symbol id (prefixed with `lu:` in the DB).
 */
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

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_LUCIDE_ICONS.map((entry) => [entry.id, entry.icon]),
);

export const LUCIDE_SYMBOL_PREFIX = "lu:";

/** A symbol like "lu:home" resolves to the matching Lucide component. */
export function resolveLucideIcon(symbol: string | null | undefined): LucideIcon | null {
  if (!symbol || !symbol.startsWith(LUCIDE_SYMBOL_PREFIX)) return null;
  return ICON_MAP[symbol.slice(LUCIDE_SYMBOL_PREFIX.length)] ?? null;
}

export function isLucideSymbol(symbol: string | null | undefined): boolean {
  return !!symbol && symbol.startsWith(LUCIDE_SYMBOL_PREFIX);
}

export function makeLucideSymbol(id: string): string {
  return `${LUCIDE_SYMBOL_PREFIX}${id}`;
}
