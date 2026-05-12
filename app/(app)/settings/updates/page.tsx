"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, Sparkles, Wrench, ArrowUpCircle } from "lucide-react";
import { CHANGELOG, type ChangeEntry } from "@/lib/changelog";
import { useT, useLang } from "@/lib/i18n/provider";

export default function UpdatesPage() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-4 pb-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("settings.updates")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <div className="px-5 space-y-4">
        {CHANGELOG.map((entry) => (
          <div
            key={entry.version}
            className="rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] overflow-hidden"
          >
            {/* Version header */}
            <div className="flex items-baseline justify-between px-4 pt-4 pb-3 border-b border-[var(--separator)]">
              <p className="text-[17px] font-bold text-[var(--foreground)] tracking-tight">
                v{entry.version}
              </p>
              <p className="text-[12px] text-[var(--label-tertiary)]">{entry.date}</p>
            </div>

            {/* Changes */}
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
        ))}
      </div>
    </div>
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
