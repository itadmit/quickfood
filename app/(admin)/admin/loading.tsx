import { Skeleton } from "@/components/shared/Skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="rounded-2xl bg-white border border-qf-line-dash overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-qf-line-dash">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-5 gap-4 px-4 py-3.5 border-b border-qf-line-soft last:border-0"
          >
            {Array.from({ length: 5 }).map((_, col) => (
              <Skeleton
                key={col}
                className={col === 0 ? "h-4 w-3/4" : "h-3 w-1/2"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
