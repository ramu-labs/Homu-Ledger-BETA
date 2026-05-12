import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Visual elevation: card (resting) or float (raised, has stronger shadow). */
  elevation?: "card" | "float";
  /** Tag override — default <div>, but lists often want <ul>. */
  as?: "div" | "ul" | "section";
};

/**
 * Resting surface with subtle ring + shadow. Default radius is --radius-xl
 * (the project's most common card radius). Override via className when you
 * need a different shape (e.g. pill, sheet, top-only rounding).
 */
export default function SurfaceCard({ children, className, elevation = "card", as: Tag = "div" }: Props) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-xl)] bg-[var(--surface)] ring-1 ring-[var(--ring-subtle)]",
        elevation === "card" ? "shadow-[var(--shadow-card)]" : "shadow-[var(--shadow-float)]",
        className
      )}
    >
      {children}
    </Tag>
  );
}
