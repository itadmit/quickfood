import { Skeleton } from "@/components/shared/Skeleton";
import { PageHeaderSkeleton } from "@/components/merchant/v2/PageHeaderSkeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton withActions />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div
            key={col}
            className="rounded-2xl bg-white border-2 border-black p-3 space-y-3 min-h-75"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32" />
            <div className="space-y-3 pt-2">
              {Array.from({ length: 3 - (col % 2) }).map((_, row) => (
                <div
                  key={row}
                  className="rounded-xl border border-qf-line-dash p-3 space-y-2"
                >
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full rounded-lg mt-2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
