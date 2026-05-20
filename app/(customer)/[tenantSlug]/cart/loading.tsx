import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Skeleton mirrors CustomerCart's authenticated layout: sticky top bar,
 * a list of cart lines (image + name + qty + price), the summary rows,
 * and the floating CTA bar.
 */
export default function CartLoading() {
  return (
    <div className="pb-44">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line">
        <Skeleton className="w-9 h-9 rounded-full" />
        <Skeleton className="h-5 w-24" />
      </header>

      <div className="px-5 mt-3 space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-qf-line p-3 flex gap-3"
          >
            <Skeleton className="w-16 h-16 rounded-xl" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/3" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="px-5 mt-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      </section>

      <div className="fixed bottom-20 inset-x-0 z-30 max-w-md mx-auto px-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
