import { Skeleton } from "@/components/shared/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <section
        className="rounded-3xl overflow-hidden border-2 border-black shadow-[0_3px_0_#000] p-5 lg:p-7"
        style={{ backgroundColor: "#F8CB1E" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-16 rounded-md bg-black/15" />
          <Skeleton className="h-3 w-44 bg-black/10" />
        </div>
        <Skeleton className="h-10 lg:h-12 w-72 max-w-full bg-black/15 rounded-lg" />
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border-2 border-black p-4 space-y-3"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white border-2 border-black p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl bg-white border-2 border-black p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
