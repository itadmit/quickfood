import { Skeleton } from "@/components/shared/Skeleton";

export function PageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <section
      className="relative rounded-3xl overflow-hidden border-2 border-black shadow-[0_3px_0_#000] p-5 lg:p-7"
      style={{ backgroundColor: "#F8CB1E" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-16 rounded-md bg-black/15" />
            <Skeleton className="h-3 w-44 bg-black/10" />
          </div>
          <Skeleton className="h-10 lg:h-12 w-64 max-w-full bg-black/15 rounded-lg" />
        </div>
        {withActions && (
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 rounded-xl bg-black/15" />
          </div>
        )}
      </div>
    </section>
  );
}
