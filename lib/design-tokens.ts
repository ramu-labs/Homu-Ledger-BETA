/**
 * Design-token registry for the in-app DesignSystem catalog.
 *
 * Every editable token surfaces here. The catalog page reads this list to
 * render the editor UI (one input per token) and to serialize the current
 * overrides into a CSS block for clipboard export.
 *
 * IMPORTANT: keep this in sync with `app/globals.css`. The defaults below
 * must match the values in `:root` / `[data-theme="dark"]` so the "Reset"
 * button restores the canonical look. The catalog page warns if it spots a
 * drift, but it can't detect missing tokens — add new entries here when
 * you add new --vars to globals.
 */

export type TokenType = "color" | "size" | "number" | "shadow" | "string";

export type TokenDef = {
  /** CSS custom property name including the leading `--` */
  name: string;
  /** Human label shown in the editor */
  label: string;
  /** UI control to render: color picker, px input, number, etc. */
  type: TokenType;
  /** Section heading the token lives under in the catalog */
  category: TokenCategory;
  /** Default value in light mode (matches :root) */
  light: string;
  /**
   * Default value in dark mode (matches [data-theme="dark"]). Leave as `null`
   * for tokens that don't vary by theme (radii, typography, spacing, z-index).
   */
  dark: string | null;
  /** One-line description shown next to the control */
  hint?: string;
};

export type TokenCategory =
  | "Theme"
  | "Rings"
  | "Status tints"
  | "Finance"
  | "Shadows"
  | "Radii"
  | "Typography"
  | "Spacing"
  | "Z-index"
  | "Motion";

export const TOKENS: TokenDef[] = [
  // ── Theme ────────────────────────────────────────────────────────────
  { name: "--background",       label: "Background",         type: "color",  category: "Theme", light: "#f6f1e9", dark: "#1a1814", hint: "Page background" },
  { name: "--surface",          label: "Surface",            type: "color",  category: "Theme", light: "#fefcf8", dark: "#25221e", hint: "Cards, sheets, surfaces above bg" },
  { name: "--foreground",       label: "Foreground",         type: "color",  category: "Theme", light: "#2a2520", dark: "#f5f0e8", hint: "Primary text + dark CTA bg" },
  { name: "--on-foreground",    label: "On-foreground",      type: "color",  category: "Theme", light: "#ffffff", dark: "#1a1814", hint: "Text/icon on bg-[var(--foreground)]" },
  { name: "--separator",        label: "Separator",          type: "color",  category: "Theme", light: "rgba(66, 52, 40, 0.08)", dark: "rgba(245, 240, 232, 0.10)", hint: "Hairline dividers" },
  { name: "--label-secondary",  label: "Label · secondary",  type: "color",  category: "Theme", light: "rgba(66, 52, 40, 0.55)", dark: "rgba(245, 240, 232, 0.60)" },
  { name: "--label-tertiary",   label: "Label · tertiary",   type: "color",  category: "Theme", light: "rgba(66, 52, 40, 0.38)", dark: "rgba(245, 240, 232, 0.40)" },
  { name: "--accent",           label: "Accent",             type: "color",  category: "Theme", light: "#b5663a", dark: "#c4794d", hint: "Highlight color (check marks, links)" },

  // ── Rings ────────────────────────────────────────────────────────────
  { name: "--ring-subtle",      label: "Ring · subtle",      type: "color",  category: "Rings", light: "rgba(0, 0, 0, 0.04)", dark: "rgba(255, 255, 255, 0.06)" },
  { name: "--ring-default",     label: "Ring · default",     type: "color",  category: "Rings", light: "rgba(0, 0, 0, 0.06)", dark: "rgba(255, 255, 255, 0.10)" },
  { name: "--ring-strong",      label: "Ring · strong",      type: "color",  category: "Rings", light: "rgba(0, 0, 0, 0.15)", dark: "rgba(255, 255, 255, 0.18)" },

  // ── Status tints ─────────────────────────────────────────────────────
  { name: "--tint-success-bg",  label: "Success · bg",       type: "color",  category: "Status tints", light: "rgba(167, 243, 208, 0.85)", dark: "rgba(16, 185, 129, 0.18)" },
  { name: "--tint-success-text",label: "Success · text",     type: "color",  category: "Status tints", light: "#065f46", dark: "#6ee7b7" },
  { name: "--tint-warning-bg",  label: "Warning · bg",       type: "color",  category: "Status tints", light: "rgba(253, 230, 138, 0.85)", dark: "rgba(245, 158, 11, 0.18)" },
  { name: "--tint-warning-text",label: "Warning · text",     type: "color",  category: "Status tints", light: "#92400e", dark: "#fcd34d" },
  { name: "--tint-info-bg",     label: "Info · bg",          type: "color",  category: "Status tints", light: "rgba(191, 219, 254, 0.85)", dark: "rgba(59, 130, 246, 0.20)" },
  { name: "--tint-info-text",   label: "Info · text",        type: "color",  category: "Status tints", light: "#1e40af", dark: "#93c5fd" },
  { name: "--tint-danger-bg",   label: "Danger · bg",        type: "color",  category: "Status tints", light: "rgba(254, 205, 211, 0.85)", dark: "rgba(244, 63, 94, 0.20)" },
  { name: "--tint-danger-text", label: "Danger · text",      type: "color",  category: "Status tints", light: "#9f1239", dark: "#fda4af" },

  // ── Finance ──────────────────────────────────────────────────────────
  { name: "--color-income",     label: "Income",             type: "color",  category: "Finance", light: "#059669", dark: "#34d399", hint: "Positive amounts, +X.XX" },
  { name: "--color-expense",    label: "Expense",            type: "color",  category: "Finance", light: "#dc2626", dark: "#f87171", hint: "Negative amounts, -X.XX" },

  // ── Shadows ──────────────────────────────────────────────────────────
  { name: "--shadow-card",      label: "Card",               type: "shadow", category: "Shadows", light: "0 1px 2px rgba(0, 0, 0, 0.03)", dark: "0 1px 2px rgba(0, 0, 0, 0.40)" },
  { name: "--shadow-float",     label: "Floating",           type: "shadow", category: "Shadows", light: "0 6px 18px rgba(42, 37, 32, 0.12), 0 1px 4px rgba(42, 37, 32, 0.08)", dark: "0 6px 24px rgba(0, 0, 0, 0.55), 0 1px 4px rgba(0, 0, 0, 0.40)" },
  { name: "--shadow-sheet",     label: "Sheet",              type: "shadow", category: "Shadows", light: "0 -8px 24px rgba(0, 0, 0, 0.12)", dark: "0 -8px 28px rgba(0, 0, 0, 0.55)" },

  // ── Radii ────────────────────────────────────────────────────────────
  { name: "--radius-sm",        label: "Small",              type: "size",   category: "Radii", light: "0.5rem", dark: null },
  { name: "--radius-md",        label: "Medium",             type: "size",   category: "Radii", light: "0.75rem", dark: null },
  { name: "--radius-lg",        label: "Large",              type: "size",   category: "Radii", light: "1rem", dark: null },
  { name: "--radius-xl",        label: "Extra large",        type: "size",   category: "Radii", light: "1.5rem", dark: null, hint: "Cards, surfaces" },
  { name: "--radius-2xl",       label: "2× extra large",     type: "size",   category: "Radii", light: "1.75rem", dark: null, hint: "Sheets, modals" },
  { name: "--radius-pill",      label: "Pill",               type: "size",   category: "Radii", light: "9999px", dark: null },

  // ── Typography ───────────────────────────────────────────────────────
  { name: "--text-xs",          label: "XS",                 type: "size",   category: "Typography", light: "11px", dark: null, hint: "Eyebrow labels, group titles" },
  { name: "--text-sm",          label: "SM",                 type: "size",   category: "Typography", light: "12px", dark: null },
  { name: "--text-md",          label: "MD",                 type: "size",   category: "Typography", light: "13px", dark: null },
  { name: "--text-base",        label: "Base",               type: "size",   category: "Typography", light: "15px", dark: null, hint: "Default body" },
  { name: "--text-lg",          label: "LG",                 type: "size",   category: "Typography", light: "17px", dark: null, hint: "Page titles" },
  { name: "--text-xl",          label: "XL",                 type: "size",   category: "Typography", light: "20px", dark: null },
  { name: "--text-2xl",         label: "2XL",                type: "size",   category: "Typography", light: "28px", dark: null, hint: "Hero numbers (balance)" },

  // ── Spacing ──────────────────────────────────────────────────────────
  { name: "--space-page-x",     label: "Page · horizontal",  type: "size",   category: "Spacing", light: "1.25rem", dark: null },
  { name: "--space-row-x",      label: "Row · horizontal",   type: "size",   category: "Spacing", light: "1rem", dark: null },
  { name: "--space-row-y",      label: "Row · vertical",     type: "size",   category: "Spacing", light: "0.875rem", dark: null },
  { name: "--space-section-y",  label: "Section · vertical", type: "size",   category: "Spacing", light: "1.25rem", dark: null },
  { name: "--gap-tight",        label: "Gap · tight",        type: "size",   category: "Spacing", light: "0.5rem", dark: null },
  { name: "--gap-default",      label: "Gap · default",      type: "size",   category: "Spacing", light: "0.625rem", dark: null },
  { name: "--gap-loose",        label: "Gap · loose",        type: "size",   category: "Spacing", light: "0.75rem", dark: null },

  // ── Z-index ──────────────────────────────────────────────────────────
  { name: "--z-header",         label: "Header",             type: "number", category: "Z-index", light: "20", dark: null },
  { name: "--z-shield",         label: "Status-bar shield",  type: "number", category: "Z-index", light: "30", dark: null },
  { name: "--z-fab",            label: "FAB / bottom nav",   type: "number", category: "Z-index", light: "50", dark: null },
  { name: "--z-sheet-overlay",  label: "Sheet overlay",      type: "number", category: "Z-index", light: "55", dark: null },
  { name: "--z-sheet-content",  label: "Sheet content",      type: "number", category: "Z-index", light: "60", dark: null },
  { name: "--z-toast",          label: "Toast",              type: "number", category: "Z-index", light: "70", dark: null },

  // ── Motion ───────────────────────────────────────────────────────────
  { name: "--press-scale",      label: "Press scale",        type: "number", category: "Motion", light: "0.97", dark: null, hint: "Used in active:scale-[var(--press-scale)]" },
  { name: "--transition-fast",  label: "Transition · fast",  type: "string", category: "Motion", light: "150ms ease-out", dark: null },
  { name: "--transition-base",  label: "Transition · base",  type: "string", category: "Motion", light: "220ms cubic-bezier(0.22, 1, 0.36, 1)", dark: null },
];

/** localStorage key for design override JSON. Shape: { "--token:light": value, "--token:dark": value, ... } */
export const OVERRIDE_STORAGE_KEY = "homu-design-overrides";

export type OverrideMap = Record<string, string>;

/** Build the storage key for a token in a given mode. */
export function overrideKey(tokenName: string, mode: "light" | "dark"): string {
  return `${tokenName}:${mode}`;
}

/** Group tokens by category for the catalog UI. */
export function tokensByCategory(): Record<TokenCategory, TokenDef[]> {
  const out = {} as Record<TokenCategory, TokenDef[]>;
  for (const t of TOKENS) {
    (out[t.category] ??= []).push(t);
  }
  return out;
}

/**
 * Serialize the current override set into a CSS block matching the
 * `:root` / `[data-theme="dark"]` layout of globals.css. Only includes
 * tokens whose value differs from the default.
 */
export function overridesToCss(overrides: OverrideMap): string {
  const lightLines: string[] = [];
  const darkLines: string[] = [];
  for (const t of TOKENS) {
    const lk = overrideKey(t.name, "light");
    const dk = overrideKey(t.name, "dark");
    if (overrides[lk] && overrides[lk] !== t.light) {
      lightLines.push(`  ${t.name}: ${overrides[lk]};`);
    }
    if (t.dark !== null && overrides[dk] && overrides[dk] !== t.dark) {
      darkLines.push(`  ${t.name}: ${overrides[dk]};`);
    }
  }
  if (lightLines.length === 0 && darkLines.length === 0) {
    return "/* No overrides — current values match the defaults. */";
  }
  const parts: string[] = [];
  if (lightLines.length > 0) {
    parts.push(`:root {\n${lightLines.join("\n")}\n}`);
  }
  if (darkLines.length > 0) {
    parts.push(`[data-theme="dark"] {\n${darkLines.join("\n")}\n}`);
    parts.push(`@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {\n${darkLines.map((l) => "  " + l).join("\n")}\n  }\n}`);
  }
  return parts.join("\n\n");
}
