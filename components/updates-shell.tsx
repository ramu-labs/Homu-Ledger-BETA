"use client";

// Updates list with User / Developer tab switcher (v1.28.0).
//
// Why two tabs:
//   - "User" gets plain-language release notes, focused on what the
//     user can DO differently — written so non-engineers understand.
//     This is the default tab.
//   - "Developer" gets the full technical breakdown (migrations, RPCs,
//     RLS policy changes, file paths, etc). Only shown to is_developer
//     accounts to avoid scaring non-devs with `auth.uid()` chatter.
//
// Filtering is done by the `audience` field on each ChangeEntry.
// Entries with audience='all' or no field at all show in BOTH tabs
// (covers legacy entries pre-v1.28.0 that were written before the
// split — they were technically detailed but already in production
// changelogs, so re-tagging them retroactively isn't worth the diff).
//
// We also hide entire version blocks whose visible changes (after
// filter) is empty — otherwise the User tab would show empty
// version cards for releases that were purely dev-only.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Sparkles, Wrench, ArrowUpCircle } from "lucide-react";
import { CHANGELOG, type Audience, type ChangeEntry } from "@/lib/changelog";
import { useT, useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

type Tab = "user" | "dev";

export default function UpdatesShell({ showDevTab }: { showDevTab: boolean }) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  // Default to the User tab. Devs land here too — they can flip the
  // tab if they want the technical breakdown.
  const [tab, setTab] = useState<Tab>("user");

  const versions = CHANGELOG
    .map((entry) => ({
      ...entry,
      changes: entry.changes.filter((c) => matchesTab(c.audience, tab)),
    }))
    // Drop versions that have zero visible changes for this tab.
    .filter((entry) => entry.changes.length > 0);

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("settings.updates")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      {/* Tab switcher — only show if the dev tab is available. Non-devs
          get the User-only view with no extra chrome, identical to the
          pre-v1.28.0 page from their perspective. */}
      {showDevTab && (
        <div className="mx-5 mb-3 flex gap-1 rounded-full bg-black/[0.05] p-1">
          <TabButton active={tab === "user"} onClick={() => setTab("user")}>
            {t("updates.tabUser")}
          </TabButton>
          <TabButton active={tab === "dev"} onClick={() => setTab("dev")}>
            {t("updates.tabDev")}
          </TabButton>
        </div>
      )}

      <div className="px-5 space-y-4">
        {versions.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface)] px-4 py-10 text-center text-[14px] text-[var(--label-secondary)] ring-1 ring-black/[0.04]">
            {t("updates.empty")}
          </p>
        ) : (
          versions.map((entry) => (
            <div
              key={entry.version}
              className="rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] overflow-hidden"
            >
              <div className="flex items-baseline justify-between px-4 pt-4 pb-3 border-b border-[var(--separator)]">
                <p className="text-[17px] font-bold text-[var(--foreground)] tracking-tight">
                  v{entry.version}
                </p>
                <p className="text-[12px] text-[var(--label-tertiary)]">{entry.date}</p>
              </div>

              <ul className="px-4 py-3 space-y-2.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <ChangeIcon type={change.type} />
                    <p className="text-[14px] text-[var(--foreground)] leading-snug pt-0.5">
                      {lang === "id" ? change.id : change.en}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Does this entry (with the given audience tag) show on the given tab?
 *
 *   - undefined / 'all' → shows on both tabs (backwards-compatible
 *                          default for legacy entries pre-v1.28.0)
 *   - 'user'            → User tab only
 *   - 'dev'             → Developer tab only
 */
function matchesTab(audience: Audience | undefined, tab: Tab): boolean {
  if (!audience || audience === "all") return true;
  return audience === tab;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--label-secondary)]"
      )}
    >
      {children}
    </button>
  );
}

function ChangeIcon({ type }: { type: ChangeEntry["type"] }) {
  if (type === "new") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Sparkles className="h-[11px] w-[11px]" strokeWidth={2.5} />
      </span>
    );
  }
  if (type === "fix") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500">
        <Wrench className="h-[11px] w-[11px]" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
      <ArrowUpCircle className="h-[11px] w-[11px]" strokeWidth={2.5} />
    </span>
  );
}
