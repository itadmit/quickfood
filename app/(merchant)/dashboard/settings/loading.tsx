import { Skeleton } from "@/components/shared/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-5">
      <section
        className="rounded-3xl overflow-hidden border-2 border-black shadow-[0_3px_0_#000]"
      >
        <div className="p-5 lg:p-7" style={{ backgroundColor: "#F8CB1E" }}>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-16 rounded-md bg-black/15" />
            <Skeleton className="h-3 w-40 bg-black/10" />
          </div>
          <Skeleton className="h-9 lg:h-10 w-48 bg-black/15 rounded-lg" />
        </div>
        <div className="bg-white border-t-2 border-black px-2.5 py-2 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-lg" />
          ))}
        </div>
      </section>

      <div className="rounded-2xl bg-white border-2 border-black p-6 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Skeleton className="h-11 w-36 rounded-xl bg-black/15" />
        </div>
      </div>
    </div>
  );
}
