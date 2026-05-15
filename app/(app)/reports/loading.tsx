export default function ReportsLoading() {
  return (
    <div className="animate-pulse pb-10">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="h-4 w-32 rounded-full bg-[var(--foreground)]/[0.07]" />
        <div className="h-8 w-28 rounded-full bg-[var(--foreground)]/[0.07]" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 px-5 pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-black/[0.04] space-y-2">
            <div className="h-2.5 w-12 rounded-full bg-[var(--foreground)]/[0.06]" />
            <div className="h-3.5 w-16 rounded-full bg-[var(--foreground)]/[0.08]" />
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div className="px-5 pt-4">
        <div className="h-10 rounded-full bg-[var(--foreground)]/[0.05]" />
      </div>

      {/* Bar chart skeleton */}
      <div className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] px-4 pt-4 pb-4">
        <div className="h-2.5 w-20 rounded-full bg-[var(--foreground)]/[0.06] mb-4" />
        <div className="flex items-end gap-1 h-[100px]">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-[var(--foreground)]/[0.06]"
              style={{ height: `${20 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </div>

      {/* Sub-tab toggle */}
      <div className="px-5 pt-4">
        <div className="h-10 rounded-full bg-[var(--foreground)]/[0.05]" />
      </div>

      {/* Donut skeleton */}
      <div className="flex justify-center pt-6">
        <div className="h-[180px] w-[180px] rounded-full bg-[var(--foreground)]/[0.06]" />
      </div>

      {/* List rows */}
      <div className="px-5 pt-5">
        <div className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[var(--foreground)]/[0.06]" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 rounded-full bg-[var(--foreground)]/[0.07]" />
                    <div className="h-2.5 w-12 rounded-full bg-[var(--foreground)]/[0.04]" />
                  </div>
                </div>
                <div className="h-3.5 w-16 rounded-full bg-[var(--foreground)]/[0.07]" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--foreground)]/[0.05]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
