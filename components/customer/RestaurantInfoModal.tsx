"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect } from "react";
import { IcoClose, IcoStar, IcoPhone, IcoPin, IcoClock, IcoBike } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BranchHours, DayKey } from "@/lib/branch-hours";

interface Props {
  tenantName: string;
  tenantSlug: string;
  cuisineType: string | null;
  about: string | null;
  address: string;
  phone: string;
  hours: BranchHours;
  minOrder: number;
  deliveryFee: number;
  serviceFee: number;
  rating: { average: number; count: number } | null;
  deliveryEta: { min: number; max: number } | null;
  onClose: () => void;
}

const DAY_KEYS: { key: DayKey; label: string }[] = [
  { key: "sunday", label: "ראשון" },
  { key: "monday", label: "שני" },
  { key: "tuesday", label: "שלישי" },
  { key: "wednesday", label: "רביעי" },
  { key: "thursday", label: "חמישי" },
  { key: "friday", label: "שישי" },
  { key: "saturday", label: "שבת" },
];

export function RestaurantInfoModal({
  tenantName,
  tenantSlug,
  cuisineType,
  about,
  address,
  phone,
  hours,
  minOrder,
  deliveryFee,
  serviceFee,
  rating,
  deliveryEta,
  onClose,
}: Props) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      html.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const todayIdx = new Date().getDay();
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qf-restaurant-info-title"
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/60 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[88vh] animate-qf-sheet-in sm:animate-qf-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-qf-line-soft">
          <div className="min-w-0">
            <h2 id="qf-restaurant-info-title" className="text-lg font-bold truncate">
              {tenantName}
            </h2>
            {cuisineType && (
              <div className="text-xs text-qf-mute truncate mt-0.5">{cuisineType}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="shrink-0 w-9 h-9 rounded-full bg-qf-line-soft grid place-items-center hover:bg-qf-line transition"
          >
            <IcoClose s={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {about && (
            <p className="text-sm text-qf-ink2 leading-relaxed whitespace-pre-line">{about}</p>
          )}

          {rating && rating.count > 0 && (
            <Link
              href={`/s/${tenantSlug}/reviews`}
              className="flex items-center justify-between gap-3 bg-qf-yolk-soft border border-qf-yolk/40 rounded-2xl p-3 hover:border-qf-yolk transition"
            >
              <div className="flex items-center gap-2">
                <IcoStar c="#e8a93b" fill="#e8a93b" s={18} />
                <div>
                  <div className="text-sm font-bold tnum">
                    {rating.average.toFixed(1)}{" "}
                    <span className="text-qf-mute font-normal">
                      ({rating.count} ביקורות)
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-(--qf-deep) text-xs font-bold">לכל הביקורות ←</span>
            </Link>
          )}

          <section>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <IcoClock s={14} c="#7c8a82" />
              שעות פעילות
            </h3>
            <ul className="text-sm space-y-1">
              {DAY_KEYS.map((d, idx) => {
                const day = hours[d.key];
                const isToday = idx === todayIdx;
                return (
                  <li
                    key={d.key}
                    className={cn(
                      "flex items-center justify-between py-1.5 px-3 rounded-lg",
                      isToday && "bg-qf-green-soft border border-(--qf-primary)/30",
                    )}
                  >
                    <span
                      className={cn(
                        "text-qf-ink2",
                        isToday && "text-qf-green-deep font-bold",
                      )}
                    >
                      {d.label}
                      {isToday && <span className="mr-1.5 text-xs">(היום)</span>}
                    </span>
                    <span
                      className={cn(
                        "tnum tabular-nums",
                        day?.active ? "text-qf-ink" : "text-qf-mute",
                      )}
                    >
                      {day?.active ? `${day.open} – ${day.close}` : "סגור"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold mb-2">פרטי קשר</h3>
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2.5 text-sm text-qf-ink2 hover:text-qf-ink"
            >
              <IcoPin s={16} c="#7c8a82" className="mt-0.5 shrink-0" />
              <span className="underline decoration-qf-line decoration-1 underline-offset-2">
                {address}
              </span>
            </a>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2.5 text-sm text-qf-ink2 hover:text-qf-ink"
                dir="ltr"
              >
                <IcoPhone s={16} c="#7c8a82" />
                <span className="underline decoration-qf-line decoration-1 underline-offset-2">
                  {phone}
                </span>
              </a>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <IcoBike s={16} c="#7c8a82" />
              עלויות ומשלוח
            </h3>
            <dl className="text-sm divide-y divide-qf-line-soft">
              <div className="flex items-center justify-between py-2">
                <dt className="text-qf-mute">מינימום הזמנה</dt>
                <dd className="tnum font-medium">
                  {minOrder > 0 ? formatPrice(minOrder) : "ללא"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-qf-mute">דמי משלוח</dt>
                <dd className="tnum font-medium">
                  {deliveryFee > 0 ? formatPrice(deliveryFee) : "חינם"}
                </dd>
              </div>
              {serviceFee > 0 && (
                <div className="flex items-center justify-between py-2">
                  <dt className="text-qf-mute">דמי שירות</dt>
                  <dd className="tnum font-medium">{formatPrice(serviceFee)}</dd>
                </div>
              )}
              {deliveryEta && (
                <div className="flex items-center justify-between py-2">
                  <dt className="text-qf-mute">זמן משלוח משוער</dt>
                  <dd className="tnum font-medium">
                    {deliveryEta.min}–{deliveryEta.max} דק&apos;
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
