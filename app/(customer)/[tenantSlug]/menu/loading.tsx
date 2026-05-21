import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Loading shell for /[tenantSlug]/menu.
 *
 * Mirrors CustomerMenu.tsx's layout — a cover hero with search, a sticky
 * row of category chips, and a vertical list of items (image left, name +
 * description + price right). Avoids the home-page grid skeleton flashing
 * before the real list paints in.
 */
export default function CustomerMenuLoading() {
  return (
    <div className="pb-32">
      {/* Hero header (cover gradient placeholder + search bar) */}
      <header className="relative bg-qf-green-soft px-5 pt-5 pb-7">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-9 h-9 rounded-full bg-white/70" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32 bg-white/70" />
            <Skeleton className="h-3 w-24 bg-white/60" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-full bg-white/80" />
      </header>

      {/* Sticky chips */}
      <div className="px-4 py-2.5 flex gap-1.5 overflow-hidden border-b border-qf-line bg-qf-bg/95">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Section header + item rows */}
      <div className="px-5 mt-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-qf-line p-3 flex gap-3"
            >
              <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-5 w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
