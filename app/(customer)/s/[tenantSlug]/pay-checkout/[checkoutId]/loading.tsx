import { Skeleton } from "@/components/shared/Skeleton";

export default function PayCheckoutLoading() {
  return (
    <div className="min-h-[80vh] max-w-md mx-auto p-5 flex flex-col gap-5">
      <header className="text-center pt-4 flex flex-col items-center gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-40" />
      </header>

      <div className="bg-white rounded-2xl border border-qf-line p-5 shadow-xs space-y-3 flex flex-col items-center">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-40" />
      </div>

      <div className="bg-(--qf-soft) rounded-2xl p-5 flex flex-col items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  );
}
