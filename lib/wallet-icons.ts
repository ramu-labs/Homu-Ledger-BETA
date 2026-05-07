import {
  Wallet,
  CreditCard,
  Landmark,
  Banknote,
  Smartphone,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icons for the wallet picker. Six options, since wallets are usually
 * a small set (Cash / Card / Bank / etc.) and we want the picker to stay tidy.
 *
 * Each entry has BOTH:
 *   - emoji: shown in 3D mode
 *   - lucideId: shown in 2D mode (uses the same icon style toggle as categories)
 *
 * The DB stores the symbol as either an emoji ("💰") or "lu:<id>" — same as
 * categories. The CategoryIcon component handles both transparently.
 */
export const WALLET_ICONS: { emoji: string; lucideId: string; icon: LucideIcon }[] = [
  { emoji: "💵", lucideId: "wallet-banknote", icon: Banknote },     // Cash
  { emoji: "💳", lucideId: "wallet-card",     icon: CreditCard },   // Credit / debit card
  { emoji: "🏦", lucideId: "wallet-bank",     icon: Landmark },     // Bank account
  { emoji: "💰", lucideId: "wallet-money",    icon: Wallet },       // Wallet / pocket money
  { emoji: "📱", lucideId: "wallet-ewallet",  icon: Smartphone },   // E-wallet (Gopay, OVO, etc.)
  { emoji: "🐷", lucideId: "wallet-savings",  icon: PiggyBank },    // Savings
];

const WALLET_LUCIDE_MAP: Record<string, LucideIcon> = Object.fromEntries(
  WALLET_ICONS.map((e) => [e.lucideId, e.icon]),
);

/** Resolve "lu:wallet-card" → CreditCard, returns null if not a wallet symbol. */
export function resolveWalletLucide(symbol: string | null | undefined): LucideIcon | null {
  if (!symbol?.startsWith("lu:")) return null;
  return WALLET_LUCIDE_MAP[symbol.slice(3)] ?? null;
}

/** Bidirectional emoji ↔ lucide id mapping (so the global 2D/3D toggle works). */
export const WALLET_EMOJI_TO_LUCIDE: Record<string, string> = Object.fromEntries(
  WALLET_ICONS.map((e) => [e.emoji, e.lucideId]),
);

export const WALLET_LUCIDE_TO_EMOJI: Record<string, string> = Object.fromEntries(
  WALLET_ICONS.map((e) => [e.lucideId, e.emoji]),
);

export function makeWalletLucideSymbol(id: string): string {
  return `lu:${id}`;
}
