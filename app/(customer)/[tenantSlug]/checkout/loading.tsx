import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Skeleton mirrors CustomerCheckout's new layout: sticky header,
 * stacked white cards (contact / delivery / summary / payment / tip / notes),
 * and the prominent fixed CTA at the bottom.
 */
export default function CheckoutLoading() {
  return (
    <div className="pb-32 bg-qf-bg/40 min-h-screen">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line">
        <Skeleton className="w-9 h-9 rounded-full" />
        <Skeleton className="h-5 w-28" />
      </header>

      <div className="px-4 mt-4 space-y-3">
        {/* Contact */}
        <Card>
          <Skeleton className="h-4 w-24" />
          <div className="mt-3 space-y-3">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
        </Card>

        {/* Delivery address */}
        <Card>
          <Skeleton className="h-4 w-28" />
          <div className="mt-3 space-y-3">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
        </Card>

        {/* Order summary */}
        <Card>
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <ul className="mt-3 divide-y divide-qf-line-soft">
            {Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="py-2.5 flex gap-3 items-start">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </Card>

        {/* Payment */}
        <Card>
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </Card>

        {/* Tip */}
        <Card>
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-4 gap-2 mt-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </Card>
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line px-4 pt-3 pb-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-qf-line p-4 shadow-xs">
      {children}
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
