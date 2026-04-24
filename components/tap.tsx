"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, forwardRef } from "react";

// iOS momentum-scroll suppresses `click` after the first tap cancels the scroll.
// `pointerup` still fires — these components fire the handler on pointerup
// (treating small-movement, quick releases as taps) so buttons/links respond
// on first tap even while the page is momentum-scrolling.

type TapLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  prefetch?: boolean;
  style?: React.CSSProperties;
};

export const TapLink = forwardRef<HTMLAnchorElement, TapLinkProps>(function TapLink(
  { href, className, children, prefetch = true, style, ...rest },
  ref
) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const navigated = useRef(false);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={prefetch}
      className={className}
      style={style}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        navigated.current = false;
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - s.t < 500) {
          navigated.current = true;
          e.preventDefault();
          router.push(href);
        }
      }}
      onClick={(e) => {
        if (navigated.current) {
          e.preventDefault();
          navigated.current = false;
        }
      }}
      {...rest}
    >
      {children}
    </Link>
  );
});

type TapButtonProps = {
  onTap: () => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
  style?: React.CSSProperties;
};

export const TapButton = forwardRef<HTMLButtonElement, TapButtonProps>(function TapButton(
  { onTap, className, children, disabled, type = "button", style, ...rest },
  ref
) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const fired = useRef(false);

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      style={style}
      className={className}
      onPointerDown={(e) => {
        if (disabled) return;
        start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        fired.current = false;
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s || disabled) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - s.t < 500) {
          fired.current = true;
          onTap();
        }
      }}
      onClick={(e) => {
        if (fired.current) {
          e.preventDefault();
          fired.current = false;
          return;
        }
        if (!disabled) onTap();
      }}
      {...rest}
    >
      {children}
    </button>
  );
});
