import { Skeleton } from "@/components/shared/Skeleton";

export default function CustomerHomeLoading() {
  return (
    <div className="pb-24">
      <header className="bg-qf-green-soft px-5 pt-5 pb-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-28 rounded-full bg-white/60" />
          <Skeleton className="h-9 w-9 rounded-full bg-white/60" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-2xl bg-white/70" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2 bg-white/70" />
            <Skeleton className="h-3 w-3/4 bg-white/60" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-xl bg-white/70" />
      </header>

      <div className="px-5 pt-5 space-y-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="px-5 pt-3 flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 space-y-2 w-16">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      <div className="px-5 pt-6 space-y-2">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="px-5 pt-3 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-qf-line-dash p-3 space-y-2"
          >
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between pt-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
