import { Skeleton } from "@/components/shared/Skeleton";

export default function ItemModalSkeleton() {
  return (
    <div className="pb-32 lg:pb-0 min-h-[92dvh] lg:min-h-[92vh]">

      <div className="relative">
        <Skeleton className="h-64 sm:h-80 lg:h-105 rounded-none" />
      </div>

      <section className="bg-white px-5 pt-5 pb-5 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="h-6 w-2/3" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <Skeleton className="h-5 w-20" />
      </section>

      <section className="bg-white mt-2 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto lg:static lg:inset-auto lg:max-w-none lg:mx-0">
        <div className="bg-white border-t border-qf-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 lg:pb-4 lg:px-5">
          <Skeleton className="h-12 w-28 rounded-full" />
          <Skeleton className="flex-1 h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
