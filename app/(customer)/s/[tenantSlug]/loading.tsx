import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Storefront fallback. Mirrors <CustomerHome/> so the click-to-paint
 * transition stays shape-stable on both mobile and desktop:
 *   - hero (cover-image-replacement) - green on mobile, neutral on desktop
 *   - status pill straddling the hero/body seam
 *   - previous-orders row (2 cards on mobile, 3 on desktop)
 *   - categories rail (16x16 mobile / 6–8 col grid on lg+)
 *   - popular items (horizontal scroll mobile / 4–6 col grid on lg+)
 *   - full menu list block
 */
export default function CustomerHomeLoading() {
  return (
    <div className="pb-24 lg:pb-12">
      {/* Hero - replaces the cover image / theme band */}
      <header className="relative bg-(--qf-primary) px-5 pt-5 pb-12 overflow-hidden rounded-b-3xl lg:rounded-none lg:px-6 lg:pt-12 lg:pb-16">
        <div className="lg:max-w-7xl lg:mx-auto">
          {/* Mobile pill + icon row */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <Skeleton className="h-8 w-28 rounded-full bg-white/30" />
            <Skeleton className="h-9 w-9 rounded-full bg-white/30" />
          </div>
          {/* Mobile compact name row */}
          <div className="flex items-center gap-3 lg:hidden">
            <Skeleton className="w-14 h-14 rounded-2xl bg-white/40" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2 bg-white/40" />
              <Skeleton className="h-3 w-3/4 bg-white/30" />
            </div>
          </div>
          {/* Desktop name + cuisine + search */}
          <div className="hidden lg:flex items-center gap-4 mb-6">
            <Skeleton className="w-20 h-20 rounded-2xl bg-white/30" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-9 w-72 bg-white/40" />
              <Skeleton className="h-4 w-48 bg-white/30" />
            </div>
          </div>
          {/* Delivery/pickup toggle */}
          <div className="hidden lg:grid grid-cols-2 gap-1 lg:max-w-sm bg-white/15 rounded-2xl p-1 mb-4">
            <Skeleton className="h-9 rounded-xl bg-white/40" />
            <Skeleton className="h-9 rounded-xl bg-white/25" />
          </div>
          {/* Mobile search bar */}
          <Skeleton className="lg:hidden mt-4 h-11 w-full rounded-full bg-white/40" />
        </div>
      </header>

      {/* Status pill - straddles the seam, exactly like the real page */}
      <section className="px-5 -mt-6 relative z-10 lg:max-w-7xl lg:mx-auto lg:px-6 lg:-mt-7">
        <Skeleton className="h-12 rounded-full bg-white shadow-sm lg:max-w-2xl lg:mx-auto" />
      </section>

      {/* Previous orders rail - desktop shows up to 3 in a row */}
      <section className="px-5 mt-5 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-8">
        <div className="flex items-center justify-between mb-2 lg:mb-4">
          <Skeleton className="h-4 lg:h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-qf-line p-3 flex items-center gap-3"
            >
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
          ))}
          {/* Third tile only on lg+ to fill the 3-col row */}
          <div className="hidden lg:flex bg-white rounded-2xl border border-qf-line p-3 items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-5 mt-5 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-10">
        <Skeleton className="h-5 lg:h-6 w-24 mb-2 lg:mb-4" />
        <div className="flex gap-2 overflow-hidden -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-6 xl:grid-cols-8 lg:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 bg-white rounded-2xl border border-qf-line px-4 py-3 min-w-22 lg:min-w-0 text-center"
            >
              <Skeleton className="w-10 h-10 rounded-full mx-auto mb-2" />
              <Skeleton className="h-3 w-14 mx-auto" />
            </div>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section className="px-5 mt-5 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-10">
        <div className="flex items-center justify-between mb-2 lg:mb-4">
          <Skeleton className="h-5 lg:h-6 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex gap-3 overflow-hidden -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 xl:grid-cols-6 lg:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-44 lg:w-auto bg-white rounded-2xl border border-qf-line overflow-hidden"
            >
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Full menu */}
      <section className="px-5 mt-8 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-12">
        <Skeleton className="h-5 lg:h-6 w-28 mb-3" />
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-qf-line p-3 flex gap-3"
            >
              <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
