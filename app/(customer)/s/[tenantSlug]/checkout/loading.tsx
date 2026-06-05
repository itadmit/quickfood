import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Skeleton mirrors CustomerCheckout. Real layout:
 *   mobile  = stacked cards + fixed footer CTA
 *   desktop = max-w-6xl 2-col grid, form cards on the left, sticky
 *             order-summary sidebar on the right with the CTA inside it.
 */
export default function CheckoutLoading() {
  return (
    <div className="pb-32 bg-qf-bg/40 min-h-screen lg:bg-transparent lg:pb-12">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line lg:bg-transparent lg:border-0 lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-6 lg:pb-2">
        <Skeleton className="w-9 h-9 rounded-full lg:hidden" />
        <Skeleton className="h-5 w-28 lg:h-8 lg:w-56" />
      </header>

      <div className="px-4 mt-4 space-y-3 lg:max-w-6xl lg:mx-auto lg:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0 lg:mt-4">
        <div className="lg:col-start-1 space-y-3 lg:space-y-4">
          {/* 1. Contact */}
          <Card>
            <Skeleton className="h-4 w-24" />
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldSkeleton />
              <FieldSkeleton />
              <div className="sm:col-span-2">
                <FieldSkeleton />
              </div>
            </div>
          </Card>

          {/* 2. Delivery address */}
          <Card>
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <FieldSkeleton />
              </div>
              <FieldSkeleton />
              <FieldSkeleton />
              <div className="sm:col-span-2">
                <FieldSkeleton />
              </div>
            </div>
          </Card>

          {/* 3. Order summary - mobile only (desktop puts this in the sidebar). */}
          <div className="lg:hidden">
            <SummaryCardSkeleton />
          </div>

          {/* 4. Payment */}
          <Card>
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
            <Skeleton className="h-3 w-3/4 mt-2" />
          </Card>

          {/* 5. Tip */}
          <Card>
            <div className="flex items-baseline justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-2xl" />
              ))}
            </div>
          </Card>

          {/* 6. Notes */}
          <Card>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-2xl mt-3" />
          </Card>
        </div>

        {/* Desktop sticky sidebar - full summary card with CTA inside it. */}
        <aside className="hidden lg:block lg:col-start-2 lg:sticky lg:top-20 lg:self-start">
          <SummaryCardSkeleton withCta />
        </aside>
      </div>

      {/* Mobile-only fixed CTA. */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line px-4 pt-3 pb-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-qf-line p-4 shadow-xs">
      {children}
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}

function SummaryCardSkeleton({ withCta = false }: { withCta?: boolean }) {
  return (
    <Card>
      <Skeleton className="h-5 w-28" />
      <ul className="mt-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <li key={i} className="flex gap-3 items-start">
            <Skeleton className="w-14 h-14 rounded-xl" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-8" />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3 border-t border-qf-line-soft space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="pt-3 mt-1 border-t border-qf-line-soft flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      {withCta && <Skeleton className="h-14 w-full rounded-2xl mt-4" />}
    </Card>
  );
}
