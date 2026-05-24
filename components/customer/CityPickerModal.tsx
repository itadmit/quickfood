"use client";

import { useMemo, useState } from "react";
import { IcoPin, IcoSearch, IcoBag, IcoCheck, IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Props {
  /** Tenant name, surfaced in the modal title so it feels personal. */
  tenantName: string;
  /** Cover/hero image URL for the modal banner. Falls back to a
   *  yellow pattern when null. */
  coverImage: string | null;
  /** Cities the merchant has marked as covered (union of all active zones). */
  cities: string[];
  /** Merchant-level toggle. When false the pickup option is rendered as a
   *  muted, non-selectable tab — the modal still opens so the customer
   *  sees why their tap on "איסוף" did nothing. Defaults to true. */
  pickupEnabled?: boolean;
  /** The branch address — shown when the customer picks "pickup". */
  branchAddress: string | null;
  /** True if this is the first time the modal opens — used to choose the
   *  copy on the close button (no "ביטול" until they've made a choice). */
  required: boolean;
  /** "delivery" | "pickup" — what method the modal initially highlights. */
  initialMethod: "delivery" | "pickup";
  onChoose: (choice: { kind: "delivery"; city: string } | { kind: "pickup" }) => void;
  onClose: () => void;
}

/**
 * "Do we deliver to you?" modal — shown on first visit to a storefront
 * and any time the customer taps the location chip in the top bar.
 * V2 brand language: hero image header, bold black-bordered white
 * card with hard-offset shadow, yellow CTA. The functional split
 * stays: pick a delivery city OR confirm pickup from the branch
 * address.
 */
export function CityPickerModal({
  tenantName,
  coverImage,
  cities,
  pickupEnabled = true,
  branchAddress,
  required,
  initialMethod,
  onChoose,
  onClose,
}: Props) {
  const [method, setMethod] = useState<"delivery" | "pickup">(initialMethod);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return cities;
    const k = q.toLocaleLowerCase("he-IL");
    return cities.filter((c) => c.toLocaleLowerCase("he-IL").includes(k));
  }, [cities, query]);

  const hasCities = cities.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qf-city-picker-title"
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/60 px-4 pb-4 sm:p-6"
      onClick={() => {
        if (!required) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] flex flex-col overflow-hidden max-h-[90vh] animate-qf-check-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header — cover image when available, otherwise a
            theme-colored surface with a dot pattern, so the modal
            always opens with something hearty above the fold. */}
        <div
          className="relative h-32 w-full overflow-hidden"
          style={
            coverImage
              ? undefined
              : {
                  backgroundColor: "var(--qf-primary)",
                  backgroundImage:
                    "radial-gradient(circle, rgba(0,0,0,0.12) 1.5px, transparent 1.5px)",
                  backgroundSize: "20px 20px",
                }
          }
        >
          {coverImage && (
            // Plain <img> instead of next/image so the modal works for
            // every external cover URL (R2 / Wolt CDN / etc.) without
            // adding to the Next image-domain whitelist for each tenant.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Darkening scrim — keeps the close button + any future overlay
              text readable on bright covers (yellow pizzas, lit dishes). */}
          {coverImage && (
            <div aria-hidden className="absolute inset-0 bg-black/35" />
          )}
          {/* Soft top→bottom theme wash so the title that overlaps the
              bottom of the image stays legible regardless of what's in
              the photo. color-mix lets us tint with the tenant's
              brand color at varying opacity. Soft fall-off: starts
              later, peaks lower so the cover stays the hero. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--qf-primary) 0%, transparent) 50%, color-mix(in srgb, var(--qf-primary) 25%, transparent) 80%, color-mix(in srgb, var(--qf-primary) 55%, transparent) 100%)",
            }}
          />

          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור"
              className="absolute top-3 inset-s-3 w-9 h-9 rounded-full grid place-items-center bg-white text-black border-2 border-black shadow-[0_2px_0_#000] hover:shadow-[0_3px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
            >
              <IcoClose s={14} c="currentColor" />
            </button>
          )}
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          <header className="space-y-1.5">
            <h2
              id="qf-city-picker-title"
              className="font-black text-2xl leading-tight text-black"
            >
              מה כתובת המשלוח?
            </h2>
            <p className="text-sm text-black/65 leading-snug">
              {hasCities && pickupEnabled
                ? `בדקו אם ${tenantName} מגיעים עד אליכם — בחרו עיר למשלוח, או הזמינו לאיסוף עצמי מהסניף.`
                : hasCities && !pickupEnabled
                  ? `${tenantName} מציעים משלוחים בלבד — בחרו את העיר שלכם.`
                  : !hasCities && pickupEnabled
                    ? "המסעדה לא הגדירה ערי משלוח. אפשר להזמין לאיסוף עצמי מהסניף."
                    : "המסעדה לא מציעה משלוחים ולא איסוף עצמי בשלב זה."}
            </p>
          </header>

          {/* Method toggle */}
          <div
            className="rounded-2xl p-1 grid grid-cols-2 border-2 border-black"
            style={{
              backgroundColor: "color-mix(in srgb, var(--qf-primary) 18%, white)",
            }}
          >
            <button
              type="button"
              onClick={() => setMethod("delivery")}
              disabled={!hasCities}
              className={cn(
                "py-2.5 text-sm rounded-xl transition font-bold inline-flex items-center justify-center gap-1.5",
                method === "delivery"
                  ? "bg-black text-white"
                  : "text-black/70 hover:text-black",
                !hasCities && "opacity-40 cursor-not-allowed",
              )}
            >
              <IcoPin s={14} c="currentColor" />
              משלוח
            </button>
            <button
              type="button"
              onClick={() => setMethod("pickup")}
              disabled={!pickupEnabled}
              className={cn(
                "py-2.5 text-sm rounded-xl transition font-bold inline-flex items-center justify-center gap-1.5",
                method === "pickup"
                  ? "bg-black text-white"
                  : "text-black/70 hover:text-black",
                !pickupEnabled && "opacity-40 cursor-not-allowed",
              )}
            >
              <IcoBag s={14} c="currentColor" />
              איסוף עצמי
            </button>
          </div>

          {method === "delivery" ? (
            hasCities ? (
              <>
                <div
                  className="flex items-center gap-2 border-2 border-black rounded-xl px-3.5 py-2.5 focus-within:bg-white focus-within:shadow-[0_2px_0_#000] transition"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--qf-primary) 10%, white)",
                  }}
                >
                  <IcoSearch c="currentColor" s={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="חפש עיר"
                    className="flex-1 bg-transparent outline-none text-sm font-medium text-black placeholder:text-black/40"
                  />
                </div>
                <ul className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
                  {filtered.length === 0 ? (
                    <li className="text-center text-sm font-medium text-black/55 py-8">
                      {pickupEnabled
                        ? "לא מצאנו עיר תואמת. אפשר להזמין לאיסוף עצמי."
                        : "לא מצאנו עיר תואמת."}
                    </li>
                  ) : (
                    filtered.map((c) => (
                      <li key={c}>
                        <button
                          type="button"
                          onClick={() => onChoose({ kind: "delivery", city: c })}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-start text-sm font-bold text-black border-2 border-transparent hover:border-black hover:bg-(--qf-primary)/10 transition"
                        >
                          <IcoPin c="currentColor" s={16} />
                          <span className="flex-1">{c}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <div className="bg-[#FFE2DC] border-2 border-black rounded-xl px-3.5 py-3 text-sm font-bold text-black shadow-[0_2px_0_#000]">
                {pickupEnabled
                  ? "המסעדה לא מספקת משלוחים בשלב זה. נסו איסוף עצמי."
                  : "המסעדה לא מספקת משלוחים בשלב זה."}
              </div>
            )
          ) : pickupEnabled ? (
            <div className="space-y-3">
              <div
                className="rounded-2xl p-4 flex items-start gap-3 border-2 border-black"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--qf-primary) 18%, white)",
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-black grid place-items-center text-white border-2 border-black shadow-[0_2px_0_#000] shrink-0">
                  <IcoBag c="currentColor" s={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm text-black">
                    איסוף עצמי מהסניף
                  </div>
                  <div className="text-xs text-black/70 mt-1 leading-snug">
                    {branchAddress ?? "כתובת המסעדה תוצג בעמוד ההזמנה"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChoose({ kind: "pickup" })}
                className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-xl h-12 text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] inline-flex items-center justify-center gap-2 transition"
              >
                <IcoCheck c="currentColor" s={18} />
                אישור איסוף עצמי
              </button>
            </div>
          ) : (
            <div className="bg-[#FFE2DC] border-2 border-black rounded-xl px-3.5 py-3 text-sm font-bold text-black shadow-[0_2px_0_#000]">
              המסעדה לא מציעה איסוף עצמי. הזמינו במשלוח.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
