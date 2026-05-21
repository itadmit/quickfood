import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Loading shell for /[tenantSlug]/orders/[id].
 *
 * Mirrors components/customer/screens/OrderTracking.tsx — the violet
 * gradient hero with the celebratory check on top, the status card
 * with progress dots, the branch contact strip, and the items list.
 * Without this Next.js was falling back to the home loader (chip rail
 * + 2-col grid), which flashed a completely different layout for the
 * fraction of a second before the real tracking page hydrated.
 */
export default function OrderTrackingLoading() {
  return (
    <div className="pb-20">
      {/* Brand hero — gradient placeholder to match the live page's
          `from-(--qf-primary) to-(--qf-deep)` header so there's no
          visible jump when the page swaps in. */}
      <header className="bg-linear-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-9 h-9 rounded-full bg-white/20" />
          <Skeleton className="h-4 w-24 bg-white/25" />
        </div>
        <div className="text-center">
          <Skeleton className="mx-auto w-20 h-20 rounded-full bg-white/85" />
          <div className="mt-4 flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-44 bg-white/35" />
            <Skeleton className="h-3 w-60 bg-white/25" />
          </div>
        </div>
      </header>

      {/* Status card — same -mt-3 lift as the live page so the white
          card overlaps the hero by the same amount. */}
      <section className="px-5 -mt-3">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <ol className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="text-center space-y-2">
                <Skeleton className="mx-auto w-7 h-7 rounded-full" />
                <Skeleton className="mx-auto h-2.5 w-10" />
              </li>
            ))}
          </ol>
          <div className="pt-3 border-t border-qf-line-soft space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </section>

      {/* Branch contact card */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-qf-line p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </section>

      {/* Items list */}
      <section className="px-5 mt-4">
        <Skeleton className="h-4 w-28 mb-2" />
        <div className="bg-white rounded-2xl border border-qf-line divide-y divide-qf-line-soft">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
          <div className="px-4 py-3 flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </section>
    </div>
  );
}
