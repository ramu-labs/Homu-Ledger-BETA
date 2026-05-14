"use client";

// Changelog viewer.
//
// v1.29.0 split:
//   - `/settings/updates` (Version Updates, in the Support group) calls
//     this with view="user". Everyone — including devs — gets the
//     plain-language read.
//   - `/settings/dev-changelog` (in the Developer group, only visible
//     to is_developer accounts) calls this with view="dev". Same UI
//     shell, different filter + title.
//
// Filtering by ChangeEntry.audience:
//   - view="user" shows entries with audience='user' OR audience='all'
//     OR no audience field (legacy entries default to 'all').
//   - view="dev"  shows entries with audience='dev'  OR audience='all'
//     OR no audience field.
//
// We also hide entire version blocks whose visible changes are empty —
// otherwise the User route would show empty cards for releases that
// were purely dev-only, and vice versa.

import { useRouter } from "next/navigation";
import { ChevronLeft, Sparkles, Wrench, ArrowUpCircle } from "lucide-react";
import { CHANGELOG, type Audience, type ChangeEntry } from "@/lib/changelog";
import { useT, useLang } from "@/lib/i18n/provider";

type View = "user" | "dev";

type Props = {
  view: View;
  // Page title — passed in so the route picking this shell decides the
  // copy ("Version Updates" vs "Dev Changelog"). Keeps i18n choices
  // out of the shell.
  title: string;
};

export default function UpdatesShell({ view, title }: Props) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();

  const versions = CHANGELOG
    .map((entry) => ({
      ...entry,
      changes: entry.changes.filter((c) => matchesView(c.audience, view)),
    }))
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
          {title}
        </h1>
        <div className="h-9 w-9" />
      </header>

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
 * Does this entry (with the given audience tag) show on the given view?
 *
 *   - undefined / 'all' → shows on both routes (backwards-compatible
 *                          default for legacy entries pre-v1.28.0)
 *   - 'user'            → User route only
 *   - 'dev'             → Developer route only
 */
function matchesView(audience: Audience | undefined, view: View): boolean {
  if (!audience || audience === "all") return true;
  return audience === view;
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
