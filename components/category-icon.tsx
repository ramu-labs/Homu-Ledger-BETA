"use client";

import {
  resolveLucideIcon,
  EMOJI_TO_LUCIDE,
  LUCIDE_TO_EMOJI,
  type IconStyle,
} from "@/lib/category-icons";

type Props = {
  symbol: string | null | undefined;
  /** Global icon style — "2d" renders Lucide, "3d" renders emoji. */
  iconStyle?: IconStyle;
  /** Size in px for Lucide icons. */
  size?: number;
  /** Font size for emoji (e.g. "20px"). Defaults to `${size}px`. */
  emojiSize?: string;
  strokeWidth?: number;
  /** Passed as CSS `color` to Lucide icons so they inherit category colour. */
  color?: string;
  fallback?: React.ReactNode;
  className?: string;
};

/**
 * Renders a category icon as either a Lucide 2D icon or an emoji/text,
 * honouring the global `iconStyle` setting.
 *
 * - `iconStyle="2d"`: emojis are mapped to their Lucide equivalent; `lu:` symbols render as Lucide.
 * - `iconStyle="3d"`: `lu:` symbols are mapped back to emoji; plain emoji renders as-is.
 * - No `iconStyle`: auto-detect from the symbol itself (backward-compat).
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
    const id = EMOJI_TO_LUCIDE[symbol];
    if (id) resolved = `lu:${id}`;
  } else if (iconStyle === "3d" && symbol.startsWith("lu:")) {
    const emoji = LUCIDE_TO_EMOJI[symbol.slice(3)];
    if (emoji) resolved = emoji;
    // If no emoji mapping, fall through and render Lucide as a graceful fallback
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
