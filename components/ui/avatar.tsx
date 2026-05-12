import { cn } from "@/lib/cn";

type Props = {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Initials-on-color avatar. The dynamic backgroundColor comes from the
 * member's avatar_color field; text is white because the palette of allowed
 * avatar colors is constrained to mid-saturation hues that all read well
 * with white text.
 */
const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-9 w-9 text-[12px]",
  md: "h-11 w-11 text-[14px]",
  lg: "h-14 w-14 text-[20px]",
};

export default function Avatar({ initials, color, size = "md", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
