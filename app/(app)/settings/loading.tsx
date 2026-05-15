// Instant skeleton for /settings.
//
// Why: the settings page server-renders behind a requireSession() call
// plus a household query plus (for devs) a feedback-count query.
// Without a loading.tsx, tapping the profile chip from /transactions
// felt sluggish — the screen stayed on the previous page for ~200ms
// while the server resolved. This skeleton fills the gap instantly so
// the navigation feels snappy.
//
// Shapes intentionally match the real page (header bar, profile card,
// household section, group headers + rows) so the layout doesn't jump
// when the real content swaps in. Pulse animation reuses the same
// pattern as /transactions/loading.tsx.

export default function SettingsLoading() {
  return (
    <div className="animate-pulse pb-4">
      {/* Header */}
      <div className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <div className="h-9 w-9 rounded-full bg-black/[0.07]" />
        <div className="h-5 w-20 rounded-full bg-black/[0.06]" />
        <div className="h-9 w-9" />
      </div>

      {/* Profile card */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-black/[0.04]">
        <div className="h-14 w-14 shrink-0 rounded-full bg-black/[0.08]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded-full bg-black/[0.07]" />
          <div className="h-3 w-44 rounded-full bg-black/[0.05]" />
        </div>
        <div className="h-[18px] w-[18px] rounded bg-black/[0.04]" />
      </div>

      {/* Household section */}
      <SectionSkeleton rows={5} />

      {/* Account section (Wallets / Categories / Theme / Language / etc.) */}
      <SectionSkeleton rows={6} />

      {/* Support section */}
      <SectionSkeleton rows={3} />

      {/* Sign out button placeholder */}
      <div className="mx-5 mt-6 h-12 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04]" />
    </div>
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <section className="mt-5">
      {/* Group header */}
      <div className="mb-2 px-6">
        <div className="h-3 w-20 rounded-full bg-black/[0.05]" />
      </div>
      {/* Row stack — mirrors the real Group's overflow-hidden rounded
          container so the skeleton ↔ content swap doesn't flicker. */}
      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
            <div className="h-8 w-8 shrink-0 rounded-full bg-black/[0.05]" />
            <div className="h-4 flex-1 rounded-full bg-black/[0.05]" />
            <div className="h-[18px] w-[18px] rounded bg-black/[0.04]" />
          </li>
        ))}
      </ul>
    </section>
  );
}
