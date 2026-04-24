import { resolveLucideIcon } from "@/lib/category-icons";

type Props = {
  symbol: string | null | undefined;
  /** Size of the Lucide icon in pixels. Ignored for emoji. */
  size?: number;
  /** Font size (used for emoji) — e.g. "20px" or "text-[20px]". If omitted, defaults to `${size}px`. */
  emojiSize?: string;
  /** Optional stroke width for Lucide icons. */
  strokeWidth?: number;
  /** Fallback when symbol is empty. */
  fallback?: React.ReactNode;
  className?: string;
};

/**
 * Renders a category icon — either a Lucide 2D icon (when symbol starts with "lu:")
 * or a plain emoji string. Designed as a drop-in for `{cat.symbol}`.
 */
export function CategoryIcon({
  symbol,
  size = 20,
  emojiSize,
  strokeWidth = 2,
  fallback = "?",
  className,
}: Props) {
  if (!symbol) return <>{fallback}</>;

  const LucideIcon = resolveLucideIcon(symbol);
  if (LucideIcon) {
    return (
      <LucideIcon
        size={size}
        strokeWidth={strokeWidth}
        className={className}
      />
    );
  }

  // Emoji / plain text
  const fontSize = emojiSize ?? `${size}px`;
  return (
    <span className={className} style={{ fontSize, lineHeight: 1 }}>
      {symbol}
    </span>
  );
}
