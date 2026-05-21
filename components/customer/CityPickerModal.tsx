"use client";

import { useMemo, useState } from "react";
import { IcoPin, IcoSearch, IcoBag, IcoCheck, IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Props {
  /** Cities the merchant has marked as covered (union of all active zones). */
  cities: string[];
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
 * Wolt-style "where are you ordering to?" modal. Shown on first visit
 * to a storefront (and any time the customer taps the location chip in
 * the top bar). Supports delivery → city select, or pickup → confirm.
 */
export function CityPickerModal({
  cities,
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
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 px-4 pb-4"
      onClick={() => {
        if (!required) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-xl flex flex-col overflow-hidden max-h-[85vh] animate-qf-check-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 id="qf-city-picker-title" className="font-bold text-lg">
              איפה נפגוש אותך?
            </h2>
            <p className="text-xs text-qf-mute mt-0.5">
              {hasCities
                ? "בחר עיר למשלוח או הזמן לאיסוף מהסניף"
                : "המסעדה לא הגדירה ערי משלוח. אפשר להזמין לאיסוף עצמי."}
            </p>
          </div>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור"
              className="w-9 h-9 rounded-full grid place-items-center text-qf-mute hover:bg-qf-line-soft"
            >
              <IcoClose s={16} c="currentColor" />
            </button>
          )}
        </header>

        {/* Method toggle */}
        <div className="px-5 pb-3">
          <div className="bg-qf-line-soft rounded-2xl p-1 grid grid-cols-2">
            <button
              type="button"
              onClick={() => setMethod("delivery")}
              disabled={!hasCities}
              className={cn(
                "py-2.5 text-sm rounded-xl transition font-semibold inline-flex items-center justify-center gap-1.5",
                method === "delivery"
                  ? "bg-white text-(--qf-deep) shadow-sm"
                  : "text-qf-ink2",
                !hasCities && "opacity-40 cursor-not-allowed",
              )}
            >
              <IcoPin s={14} c="currentColor" />
              משלוח
            </button>
            <button
              type="button"
              onClick={() => setMethod("pickup")}
              className={cn(
                "py-2.5 text-sm rounded-xl transition font-semibold inline-flex items-center justify-center gap-1.5",
                method === "pickup"
                  ? "bg-white text-(--qf-deep) shadow-sm"
                  : "text-qf-ink2",
              )}
            >
              <IcoBag s={14} c="currentColor" />
              איסוף עצמי
            </button>
          </div>
        </div>

        {/* Body */}
        {method === "delivery" ? (
          hasCities ? (
            <>
              <div className="px-5 pb-3">
                <div className="flex items-center gap-2 bg-qf-bg border border-qf-line rounded-2xl px-3.5 py-2.5">
                  <IcoSearch c="#7c8a82" s={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="חפש עיר"
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-qf-mute"
                  />
                </div>
              </div>
              <ul className="flex-1 overflow-y-auto px-3 pb-3">
                {filtered.length === 0 ? (
                  <li className="text-center text-sm text-qf-mute py-8">
                    לא מצאנו עיר תואמת. אפשר להזמין לאיסוף עצמי.
                  </li>
                ) : (
                  filtered.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => onChoose({ kind: "delivery", city: c })}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-start text-sm hover:bg-qf-line-soft transition"
                      >
                        <IcoPin c="var(--qf-primary)" s={16} />
                        <span className="flex-1">{c}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : (
            <div className="px-5 pb-5">
              <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-3 text-sm text-qf-ink2">
                המסעדה לא מספקת משלוחים בשלב זה. נסה איסוף עצמי.
              </div>
            </div>
          )
        ) : (
          <div className="px-5 pb-5">
            <div className="bg-qf-line-soft rounded-2xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-qf-green-soft grid place-items-center text-(--qf-deep)">
                <IcoBag c="currentColor" s={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">איסוף עצמי מהסניף</div>
                <div className="text-xs text-qf-mute mt-1">
                  {branchAddress ?? "כתובת המסעדה תוצג בעמוד ההזמנה"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChoose({ kind: "pickup" })}
              className="w-full mt-4 bg-(--qf-primary) text-white rounded-2xl h-14 text-base font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-(--qf-primary)/25 active:scale-[0.99] transition"
            >
              <IcoCheck c="#fff" s={18} />
              אישור איסוף עצמי
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
