import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Skeleton mirrors CustomerCart: mobile = stacked list + fixed footer CTA;
 * desktop (lg+) = max-w-6xl 2-column grid with lines on the left and a
 * sticky summary card on the right.
 */
export default function CartLoading() {
  return (
    <div className="pb-44 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:px-6 lg:mt-6">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line lg:bg-transparent lg:border-0 lg:px-0 lg:pt-0 lg:pb-6">
        <Skeleton className="w-9 h-9 rounded-full lg:hidden" />
        <Skeleton className="h-5 w-24 lg:h-8 lg:w-40" />
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
          <div className="px-5 mt-3 space-y-2.5 lg:px-0 lg:mt-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-qf-line p-3.5 flex gap-3.5 shadow-xs"
              >
                <Skeleton className="w-20 h-20 rounded-xl" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-9 w-28 rounded-full" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary card — inline footer-style on mobile, sticky sidebar on desktop. */}
        <aside className="px-5 mt-5 lg:px-0 lg:mt-0 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white border border-qf-line rounded-2xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="border-t border-qf-line-soft pt-2 mt-2 flex items-center justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="hidden lg:block pt-3 mt-2 border-t border-qf-line-soft">
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile-only fixed CTA. */}
      <div className="lg:hidden fixed bottom-20 inset-x-0 z-30 max-w-md mx-auto px-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}
