"use client";

import Link from "next/link";
import { IcoStar, IcoChev } from "@/components/shared/Icons";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { BottomTabBar } from "@/components/customer/BottomTabBar";

interface Summary {
  count: number;
  average: number;
  distribution: number[];
}

interface ReviewRow {
  id: string;
  rating: number;
  text: string | null;
  replyText: string | null;
  replyAt: string | null;
  createdAt: string;
  customerName: string;
}

export function CustomerReviews({
  tenantSlug,
  summary,
  reviews,
  pendingOrderId,
}: {
  tenantSlug: string;
  summary: Summary;
  reviews: ReviewRow[];
  pendingOrderId: string | null;
}) {
  const maxDist = Math.max(1, ...summary.distribution);

  return (
    <div className="pb-20 lg:pb-12 lg:max-w-3xl lg:mx-auto lg:px-6 lg:pt-6">
      <header className="bg-linear-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-6 rounded-b-3xl lg:rounded-3xl lg:px-7 lg:pt-7 lg:pb-8 lg:shadow-md">
        <div className="flex items-center gap-3 mb-3 lg:mb-4">
          <Link
            href={`/s/${tenantSlug}`}
            aria-label="חזרה"
            className="w-9 h-9 rounded-full bg-white/15 grid place-items-center hover:bg-white/25 transition lg:w-10 lg:h-10"
          >
            <IcoChev c="#fff" s={18} />
          </Link>
          <h1 className="text-xl font-bold lg:text-2xl">ביקורות</h1>
        </div>
        <div className="flex items-baseline gap-3 lg:gap-4">
          <div className="text-4xl font-bold tnum lg:text-5xl">{summary.average.toFixed(1)}</div>
          <Stars value={summary.average} size={18} />
          <div className="text-sm opacity-90">מתוך {summary.count}</div>
        </div>
      </header>

      <section className="px-5 -mt-4 lg:px-0 lg:mt-5">
        <div className="bg-white rounded-2xl border border-qf-line shadow-sm p-4 lg:p-5 space-y-1.5 lg:space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = summary.distribution[rating - 1];
            const pct = (count / maxDist) * 100;
            return (
              <div key={rating} className="flex items-center gap-2 text-xs lg:text-sm lg:gap-3">
                <div className="tnum w-3 text-qf-ink2 lg:w-4">{rating}</div>
                <IcoStar c="#e8a93b" fill="#e8a93b" s={12} />
                <div className="flex-1 h-1.5 bg-qf-line-soft rounded-full overflow-hidden lg:h-2">
                  <div
                    className="h-full bg-qf-yolk rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="tnum w-8 text-qf-mute text-end lg:w-10">{count}</div>
              </div>
            );
          })}
        </div>
      </section>

      {pendingOrderId && (
        <section className="px-5 mt-4 lg:px-0 lg:mt-5">
          <Link
            href={`/s/${tenantSlug}/orders/${pendingOrderId}#review`}
            className="block bg-qf-green-soft border border-(--qf-primary)/30 rounded-2xl p-4 lg:p-5 hover:border-(--qf-primary)/60 transition"
          >
            <div className="font-semibold text-(--qf-deep)">רוצה לדרג את ההזמנה האחרונה?</div>
            <div className="text-xs text-qf-ink2 mt-0.5 lg:text-sm">לחץ כאן כדי להוסיף דירוג וטקסט קצר</div>
          </Link>
        </section>
      )}

      <section className="px-5 mt-4 lg:px-0 lg:mt-5 space-y-3">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-qf-line p-8 lg:p-10 text-center text-sm text-qf-mute">
            עוד לא נכתבו ביקורות. ההזמנה שלך יכולה להיות הראשונה.
          </div>
        ) : (
          reviews.map((r) => <Card key={r.id} r={r} />)
        )}
      </section>

      <BottomTabBar tenantSlug={tenantSlug} />
    </div>
  );
}

function Card({ r }: { r: ReviewRow }) {
  return (
    <article className="bg-white rounded-2xl border border-qf-line p-4 space-y-2">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-(--qf-primary) text-white grid place-items-center font-bold text-sm">
            {r.customerName.slice(0, 2)}
          </div>
          <div>
            <div className="font-medium text-sm">{r.customerName}</div>
            <div className="text-xs text-qf-mute">
              <RelativeTime date={r.createdAt} />
            </div>
          </div>
        </div>
        <Stars value={r.rating} size={14} />
      </header>

      {r.text && <p className="text-sm text-qf-ink2 leading-relaxed">{r.text}</p>}

      {r.replyText && (
        <div className="bg-qf-green-soft border-s-4 border-(--qf-primary) rounded-e-lg ps-3 py-2 text-sm">
          <div className="text-xs text-qf-green-deep font-medium">תשובת המסעדה</div>
          <div className="mt-0.5 text-qf-ink2">{r.replyText}</div>
        </div>
      )}
    </article>
  );
}

function Stars({ value, size }: { value: number; size: number }) {
  const full = Math.floor(value);
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= full;
        return (
          <IcoStar
            key={i}
            c={filled ? "#e8a93b" : "#cfcec9"}
            fill={filled ? "#e8a93b" : "none"}
            s={size}
          />
        );
      })}
    </div>
  );
}
