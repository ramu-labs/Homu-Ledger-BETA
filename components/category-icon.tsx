import { resolveLucideIcon, type IconStyle } from "@/lib/category-icons";

// Inline mapping so this file has zero "use client" ambiguity.
// Maps emoji symbol → lucide icon id.
const EMOJI_TO_LUCIDE_ID: Record<string, string> = {
  "🏠": "home", "🏡": "house", "🚗": "car", "🚙": "car",
  "🚌": "bus", "✈️": "plane", "🚂": "train", "⛽": "fuel",
  "🍔": "utensils-crossed", "🍽️": "utensils-crossed",
  "🍕": "pizza", "🍜": "soup", "🍲": "soup", "☕": "coffee",
  "🛒": "shopping-cart", "👕": "shirt", "👗": "shirt",
  "💊": "pill", "🧴": "pill", "🩺": "stethoscope", "🏥": "stethoscope",
  "❤️": "heart-pulse", "🏋️": "dumbbell", "💪": "dumbbell",
  "📚": "book-open", "🎓": "graduation-cap",
  "🎬": "film", "🎮": "gamepad-2", "🎵": "music", "🎶": "music",
  "💼": "briefcase", "💰": "wallet", "💳": "wallet",
  "🏦": "landmark", "🌐": "landmark",
  "🧾": "receipt", "📋": "receipt",
  "🎁": "gift", "🐾": "paw-print", "👶": "baby",
  "🌿": "leaf", "⚡": "zap", "🔧": "wrench", "🧹": "wrench",
  "✂️": "scissors", "📱": "smartphone", "💡": "lightbulb",
};

// Reverse: lucide id → best emoji
const LUCIDE_TO_EMOJI_ID: Record<string, string> = {};
for (const [emoji, id] of Object.entries(EMOJI_TO_LUCIDE_ID)) {
  if (!(id in LUCIDE_TO_EMOJI_ID)) LUCIDE_TO_EMOJI_ID[id] = emoji;
}

type Props = {
  symbol: string | null | undefined;
  /** "2d" = Lucide line icons, "3d" = emoji. Omit for auto-detect. */
  iconStyle?: IconStyle;
  size?: number;
  emojiSize?: string;
  strokeWidth?: number;
  color?: string;
  fallback?: React.ReactNode;
  className?: string;
};

/**
 * Renders a category icon — either a Lucide 2D icon or an emoji.
 * Respects the global iconStyle setting:
 *   "2d" → emoji symbols are mapped to their Lucide equivalent
 *   "3d" → lu: symbols are mapped back to emoji
 */
export function CategoryIcon({
  symbol,
  iconStyle,
  size = 20,
  emojiSize,
  strokeWidth = 2,
  color,
  fallback = "?",
  className,
}: Props) {
  if (!symbol) return <>{fallback}</>;

  let resolved = symbol;

  if (iconStyle === "2d" && !symbol.startsWith("lu:")) {
    const id = EMOJI_TO_LUCIDE_ID[symbol];
    if (id) resolved = `lu:${id}`;
  } else if (iconStyle === "3d" && symbol.startsWith("lu:")) {
    const emoji = LUCIDE_TO_EMOJI_ID[symbol.slice(3)];
    if (emoji) resolved = emoji;
  }

  const LucideIcon = resolveLucideIcon(resolved);
  if (LucideIcon) {
    return (
      <LucideIcon
        size={size}
        strokeWidth={strokeWidth}
        className={className}
        style={color ? { color } : undefined}
      />
    );
  }

  const fontSize = emojiSize ?? `${size}px`;
  return (
    <span className={className} style={{ fontSize, lineHeight: 1 }}>
      {resolved}
    </span>
  );
}
