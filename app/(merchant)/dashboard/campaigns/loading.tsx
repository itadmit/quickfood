import { Skeleton } from "@/components/shared/Skeleton";

export default function CampaignsLoading() {
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-qf-line-dash overflow-hidden"
          >
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex items-center justify-between pt-2 border-t border-qf-line-soft">
                <Skeleton className="h-4 w-16" />
                <div className="flex gap-1">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="w-8 h-8 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
