import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Skeleton mirrors CustomerCheckout: mobile = stacked white cards + fixed
 * footer CTA; desktop (lg+) = max-w-6xl 2-column grid with the form cards
 * on the left and a sticky summary + CTA on the right.
 */
export default function CheckoutLoading() {
  return (
    <div className="pb-32 bg-qf-bg/40 min-h-screen lg:bg-transparent lg:pb-12">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line lg:static lg:bg-transparent lg:border-0 lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-6 lg:pb-2">
        <Skeleton className="w-9 h-9 rounded-full lg:hidden" />
        <Skeleton className="h-5 w-28 lg:h-8 lg:w-44" />
      </header>

      <div className="px-4 mt-4 space-y-3 lg:max-w-6xl lg:mx-auto lg:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0 lg:mt-4">
        <div className="lg:col-start-1 space-y-3">
          {/* Contact */}
          <Card>
            <Skeleton className="h-4 w-24" />
            <div className="mt-3 space-y-3">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </Card>

          {/* Delivery address */}
          <Card>
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 space-y-3">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </Card>

          {/* Order summary — inline on mobile only; desktop shows it in the sticky sidebar. */}
          <div className="lg:hidden">
            <Card>
              <div className="flex items-baseline justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-14" />
              </div>
              <ul className="mt-3 divide-y divide-qf-line-soft">
                {Array.from({ length: 2 }).map((_, i) => (
                  <li key={i} className="py-2.5 flex gap-3 items-start">
                    <Skeleton className="w-14 h-14 rounded-xl" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </Card>
          </div>

          {/* Payment */}
          <Card>
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
          </Card>

          {/* Tip */}
          <Card>
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-4 gap-2 mt-3">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
          </Card>
        </div>

        {/* Desktop sticky sidebar — summary + CTA. */}
        <aside className="hidden lg:block lg:col-start-2 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <Skeleton className="h-4 w-24" />
            <ul className="mt-3 divide-y divide-qf-line-soft">
              {Array.from({ length: 2 }).map((_, i) => (
                <li key={i} className="py-2.5 flex gap-3 items-start">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl mt-4" />
          </Card>
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
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}
