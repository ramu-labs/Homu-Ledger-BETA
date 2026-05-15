export default function TransactionsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="h-9 w-9 rounded-full bg-[var(--foreground)]/[0.07]" />
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-4 w-32 rounded-full bg-[var(--foreground)]/[0.07]" />
          <div className="h-3 w-20 rounded-full bg-[var(--foreground)]/[0.04]" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-full bg-[var(--foreground)]/[0.07]" />
          <div className="h-9 w-9 rounded-full bg-[var(--foreground)]/[0.07]" />
        </div>
      </div>

      {/* Balance card */}
      <div className="mx-5 mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-black/[0.04]">
        <div className="h-3 w-24 rounded-full bg-[var(--foreground)]/[0.06] mx-auto" />
        <div className="h-10 w-44 rounded-full bg-[var(--foreground)]/[0.08] mx-auto mt-3" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-14 rounded-2xl bg-[var(--foreground)]/[0.04]" />
          <div className="h-14 rounded-2xl bg-[var(--foreground)]/[0.04]" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-5 pt-4">
        <div className="h-10 rounded-full bg-[var(--foreground)]/[0.05]" />
      </div>

      {/* Transaction rows */}
      <div className="mx-5 mt-3 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 min-h-[60px]">
            <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--foreground)]/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded-full bg-[var(--foreground)]/[0.07]" />
              <div className="h-3 w-20 rounded-full bg-[var(--foreground)]/[0.04]" />
            </div>
            <div className="h-3.5 w-16 rounded-full bg-[var(--foreground)]/[0.07]" />
          </div>
        ))}
      </div>
    </div>
  );
}
