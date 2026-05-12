"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Copy, RotateCcw, Sun, Moon, SunMoon, Plus } from "lucide-react";
import {
  TOKENS,
  OVERRIDE_STORAGE_KEY,
  overrideKey,
  overridesToCss,
  tokensByCategory,
  type OverrideMap,
  type TokenCategory,
  type TokenDef,
} from "@/lib/design-tokens";
import { cn } from "@/lib/cn";

// Primitives — shown in the gallery section
import SurfaceCard from "@/components/ui/surface-card";
import Button from "@/components/ui/buttons";
import Chip from "@/components/ui/chip";
import StatusPill from "@/components/ui/status-pill";
import Sheet from "@/components/ui/sheet";
import { Input, Textarea } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import Avatar from "@/components/ui/avatar";
import FilterTabs from "@/components/ui/filter-tabs";

type ViewMode = "auto" | "light" | "dark";

/**
 * Resolves the *currently visible* mode (light or dark) given the user's
 * three-way pick. "auto" → use OS preference.
 */
function resolveMode(view: ViewMode): "light" | "dark" {
  if (view === "light" || view === "dark") return view;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export default function DesignSystemShell() {
  // ── View mode (Auto / Light / Dark) ─────────────────────────────────
  // We don't touch global theme settings on mount — only when the user
  // explicitly picks. The catalog can preview a forced mode without
  // affecting the rest of the app's persisted theme choice.
  const [viewMode, setViewMode] = useState<ViewMode>("auto");
  useEffect(() => {
    if (viewMode === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = viewMode;
    }
    // When the visible mode changes, re-apply the overrides for the new
    // mode (and clear stale inline styles from the previous mode).
    reapplyOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // ── Override state ──────────────────────────────────────────────────
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [copied, setCopied] = useState(false);

  // Initial load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  // Re-apply override CSS variables onto <html> whenever overrides or
  // visible mode changes. Only the values for the *visible* mode are
  // pushed to documentElement.style — the other mode's values stay in
  // localStorage waiting their turn.
  useEffect(reapplyOverrides, [overrides, viewMode]);

  function reapplyOverrides() {
    const mode = resolveMode(viewMode);
    // Clear ALL token inline styles first so old overrides don't linger
    for (const t of TOKENS) {
      document.documentElement.style.removeProperty(t.name);
    }
    // Apply current mode's overrides
    for (const t of TOKENS) {
      const k = overrideKey(t.name, t.dark === null ? "light" : mode);
      const v = overrides[k];
      if (v) document.documentElement.style.setProperty(t.name, v);
    }
  }

  // ── Per-token mutators ──────────────────────────────────────────────
  const currentMode = resolveMode(viewMode);
  function setTokenValue(token: TokenDef, value: string) {
    const mode = token.dark === null ? "light" : currentMode;
    const k = overrideKey(token.name, mode);
    setOverrides((prev) => {
      const next = { ...prev, [k]: value };
      try { localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  function resetToken(token: TokenDef) {
    const mode = token.dark === null ? "light" : currentMode;
    const k = overrideKey(token.name, mode);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[k];
      try { localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  function resetAll() {
    if (!confirm("Clear all design overrides? This reverts every token to its default value.")) return;
    setOverrides({});
    try { localStorage.removeItem(OVERRIDE_STORAGE_KEY); } catch { /* noop */ }
  }

  async function copyCss() {
    const css = overridesToCss(overrides);
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select+copy via a temporary textarea
      const ta = document.createElement("textarea");
      ta.value = css;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ── Resolve effective value (override or default for current mode) ──
  function effectiveValue(token: TokenDef): string {
    const mode = token.dark === null ? "light" : currentMode;
    const k = overrideKey(token.name, mode);
    if (overrides[k]) return overrides[k];
    return mode === "dark" && token.dark !== null ? token.dark : token.light;
  }

  const grouped = useMemo(() => tokensByCategory(), []);
  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="pb-16">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header className="sticky top-[env(safe-area-inset-top)] z-[var(--z-header)] flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-3 backdrop-blur">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--ring-default)] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">DesignSystem</h1>
        <button
          onClick={copyCss}
          aria-label="Copy CSS"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--ring-default)] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
        >
          {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2.5} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2} />}
        </button>
      </header>

      {/* ── Mode + override status bar ─────────────────────────────── */}
      <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-[var(--radius-xl)] bg-[var(--surface)] px-3 py-2.5 ring-1 ring-[var(--ring-subtle)]">
        <div className="flex gap-1">
          <ModeButton current={viewMode} value="auto"  onChange={setViewMode} icon={<SunMoon className="h-3.5 w-3.5" />} label="Auto" />
          <ModeButton current={viewMode} value="light" onChange={setViewMode} icon={<Sun className="h-3.5 w-3.5" />}    label="Light" />
          <ModeButton current={viewMode} value="dark"  onChange={setViewMode} icon={<Moon className="h-3.5 w-3.5" />}   label="Dark" />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-[var(--label-secondary)]">
            {overrideCount > 0 ? `${overrideCount} override${overrideCount === 1 ? "" : "s"} active` : "No overrides"}
          </p>
          {overrideCount > 0 && (
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--tint-danger-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tint-danger-text)] active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              Reset all
            </button>
          )}
        </div>
      </div>

      <p className="mx-5 mt-3 text-[12px] text-[var(--label-secondary)]">
        Editing affects the <strong>{currentMode}</strong> mode. Changes are saved in
        your browser only — paste the result of <em>Copy CSS</em> into <code className="rounded bg-[var(--ring-subtle)] px-1 text-[11px]">app/globals.css</code> to ship.
      </p>

      {/* ── Token sections ─────────────────────────────────────────── */}
      {(Object.keys(grouped) as TokenCategory[]).map((category) => (
        <Section key={category} title={category}>
          <SurfaceCard as="ul" className="divide-y divide-[var(--separator)]">
            {grouped[category].map((token) => (
              <TokenRow
                key={token.name}
                token={token}
                value={effectiveValue(token)}
                onChange={(v) => setTokenValue(token, v)}
                onReset={() => resetToken(token)}
                isOverridden={!!overrides[overrideKey(token.name, token.dark === null ? "light" : currentMode)]}
                mode={currentMode}
              />
            ))}
          </SurfaceCard>
        </Section>
      ))}

      {/* ── Primitives gallery ─────────────────────────────────────── */}
      <Section title="Primitives">
        <p className="mb-3 text-[12px] text-[var(--label-secondary)]">
          Reusable React components in <code className="rounded bg-[var(--ring-subtle)] px-1 text-[11px]">components/ui/</code>. Use these
          in new code instead of hand-rolling. Token changes above ripple here automatically.
        </p>

        <PrimitiveDemo name="Buttons" path="components/ui/buttons.tsx">
          <div className="flex flex-col gap-2">
            <Button variant="primary" full>Primary</Button>
            <Button variant="secondary" full>Secondary</Button>
            <Button variant="danger" full>Danger</Button>
            <div className="flex gap-2">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="secondary" size="sm">Small</Button>
              <Button variant="primary" size="sm" disabled>Disabled</Button>
            </div>
          </div>
        </PrimitiveDemo>

        <PrimitiveDemo name="Chip" path="components/ui/chip.tsx">
          <div className="flex flex-wrap gap-2">
            <Chip selected>Selected</Chip>
            <Chip>Unselected</Chip>
            <Chip selected size="sm">SM selected</Chip>
            <Chip size="sm">SM unselected</Chip>
          </div>
        </PrimitiveDemo>

        <PrimitiveDemo name="StatusPill" path="components/ui/status-pill.tsx">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="success">Success</StatusPill>
            <StatusPill tone="warning">Warning</StatusPill>
            <StatusPill tone="info">Info</StatusPill>
            <StatusPill tone="danger">Danger</StatusPill>
          </div>
        </PrimitiveDemo>

        <PrimitiveDemo name="SurfaceCard" path="components/ui/surface-card.tsx">
          <div className="flex flex-col gap-2">
            <SurfaceCard className="p-4">
              <p className="text-[15px] font-medium text-[var(--foreground)]">Resting card</p>
              <p className="text-[12px] text-[var(--label-secondary)]">Default elevation = card</p>
            </SurfaceCard>
            <SurfaceCard elevation="float" className="p-4">
              <p className="text-[15px] font-medium text-[var(--foreground)]">Floating card</p>
              <p className="text-[12px] text-[var(--label-secondary)]">elevation=&quot;float&quot;</p>
            </SurfaceCard>
          </div>
        </PrimitiveDemo>

        <PrimitiveDemo name="Input / Textarea" path="components/ui/input.tsx">
          <div className="flex flex-col gap-2">
            <Input placeholder="Subject" />
            <Textarea placeholder="Message…" rows={3} />
          </div>
        </PrimitiveDemo>

        <PrimitiveDemo name="EmptyState" path="components/ui/empty-state.tsx">
          <EmptyState
            icon={<Plus className="h-5 w-5" />}
            title="Nothing here yet"
            subtitle="Pull-to-refresh to load, or tap + below to add one."
            action={<Button variant="primary" size="sm">Get started</Button>}
          />
        </PrimitiveDemo>

        <PrimitiveDemo name="Avatar" path="components/ui/avatar.tsx">
          <div className="flex items-center gap-3">
            <Avatar initials="A" color="#3b82f6" size="sm" />
            <Avatar initials="BC" color="#10b981" size="md" />
            <Avatar initials="DE" color="#f59e0b" size="lg" />
          </div>
        </PrimitiveDemo>

        <PrimitiveDemo name="FilterTabs" path="components/ui/filter-tabs.tsx">
          <FilterTabsDemo />
        </PrimitiveDemo>

        <PrimitiveDemo name="Sheet" path="components/ui/sheet.tsx">
          <SheetDemo />
        </PrimitiveDemo>
      </Section>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <p className="mb-2 px-6 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
        {title}
      </p>
      <div className="mx-5">{children}</div>
    </section>
  );
}

function ModeButton({
  current, value, onChange, icon, label,
}: { current: ViewMode; value: ViewMode; onChange: (v: ViewMode) => void; icon: React.ReactNode; label: string }) {
  const active = current === value;
  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
        active ? "bg-[var(--foreground)] text-[var(--on-foreground)]" : "text-[var(--label-secondary)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TokenRow({
  token, value, onChange, onReset, isOverridden, mode,
}: {
  token: TokenDef;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  isOverridden: boolean;
  mode: "light" | "dark";
}) {
  const themeAware = token.dark !== null;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Preview token={token} value={value} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium text-[var(--foreground)]">{token.label}</p>
            {!themeAware && (
              <span className="rounded-full bg-[var(--ring-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
                shared
              </span>
            )}
            {isOverridden && (
              <span className="rounded-full bg-[var(--tint-warning-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--tint-warning-text)]">
                overridden
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--label-tertiary)]">
            {token.name}
            {themeAware && <span className="ml-1 opacity-60">· {mode}</span>}
          </p>
          {token.hint && (
            <p className="mt-1 text-[12px] text-[var(--label-secondary)]">{token.hint}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <TokenInput token={token} value={value} onChange={onChange} />
            {isOverridden && (
              <button
                onClick={onReset}
                aria-label="Reset"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ring-subtle)] text-[var(--label-secondary)] active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Preview({ token, value }: { token: TokenDef; value: string }) {
  if (token.type === "color") {
    return <span className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] ring-1 ring-[var(--ring-default)]" style={{ background: value }} />;
  }
  if (token.type === "shadow") {
    return <span className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] bg-[var(--surface)]" style={{ boxShadow: value }} />;
  }
  if (token.type === "size") {
    // For radii, render a square with that radius. For typography sizes,
    // show an "Aa" specimen. For spacing, show a horizontal bar of that width.
    if (token.category === "Radii") {
      return <span className="h-10 w-10 shrink-0 bg-[var(--foreground)]" style={{ borderRadius: value }} />;
    }
    if (token.category === "Typography") {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--foreground)]" style={{ fontSize: value, lineHeight: 1 }}>
          Aa
        </span>
      );
    }
    if (token.category === "Spacing") {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-start overflow-hidden">
          <span className="h-2 rounded-r-full bg-[var(--foreground)]" style={{ width: value }} />
        </span>
      );
    }
  }
  // number / string / fallback
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ring-subtle)] font-mono text-[10px] text-[var(--label-secondary)]">{value.slice(0, 4)}</span>;
}

function TokenInput({ token, value, onChange }: { token: TokenDef; value: string; onChange: (v: string) => void }) {
  const isHex = /^#[0-9a-f]{3,8}$/i.test(value.trim());
  if (token.type === "color" && isHex) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-[var(--radius-md)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[11px] text-[var(--foreground)] outline-none ring-1 ring-[var(--ring-default)] focus:ring-2 focus:ring-[var(--foreground)]/20"
        />
      </div>
    );
  }
  if (token.type === "shadow") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="flex-1 resize-none rounded-[var(--radius-md)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[11px] text-[var(--foreground)] outline-none ring-1 ring-[var(--ring-default)] focus:ring-2 focus:ring-[var(--foreground)]/20"
      />
    );
  }
  return (
    <input
      type={token.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step={token.type === "number" ? "0.01" : undefined}
      className="flex-1 rounded-[var(--radius-md)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[11px] text-[var(--foreground)] outline-none ring-1 ring-[var(--ring-default)] focus:ring-2 focus:ring-[var(--foreground)]/20"
    />
  );
}

function PrimitiveDemo({ name, path, children }: { name: string; path: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-[var(--radius-xl)] bg-[var(--surface)] p-4 ring-1 ring-[var(--ring-subtle)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[var(--foreground)]">{name}</p>
        <code className="font-mono text-[10px] text-[var(--label-tertiary)]">{path}</code>
      </div>
      {children}
    </div>
  );
}

function FilterTabsDemo() {
  const [val, setVal] = useState<"all" | "open" | "closed">("all");
  return (
    <FilterTabs
      value={val}
      onChange={setVal}
      options={[
        { code: "all", label: "All", count: 12 },
        { code: "open", label: "Open", count: 7 },
        { code: "closed", label: "Closed", count: 5 },
      ]}
    />
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Open sheet</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Demo sheet">
        <p className="text-[14px] text-[var(--foreground)]">
          This is a Sheet primitive. Tap the X, the backdrop, or drag down to close. The background
          is scroll-locked while the sheet is open.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" size="sm" full>OK</Button>
          <Button variant="secondary" size="sm" full onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </Sheet>
    </>
  );
}
