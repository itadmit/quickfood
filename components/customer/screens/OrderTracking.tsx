"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IcoChev, IcoPhone, IcoClock, IcoCheck, IcoStar } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

interface OrderItemRow {
  id: string;
  name: string;
  quantity: number;
  total: number;
  size: string | null;
  imageUrl: string | null;
}

interface OrderData {
  id: string;
  number: string;
  status: string;
  method: "delivery" | "pickup";
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  branch: { phone: string; address: string } | null;
  items: OrderItemRow[];
  businessType: BusinessType;
}

const STAGES: Array<{ key: string; label: string }> = [
  { key: "received", label: "התקבלה" },
  { key: "preparing", label: "בהכנה" },
  { key: "ready", label: "מוכנה" },
  { key: "delivering", label: "בדרך" },
];

function stageOf(status: string): number {
  if (["pending", "confirmed"].includes(status)) return 0;
  if (["preparing", "in_oven"].includes(status)) return 1;
  if (status === "ready") return 2;
  if (status === "out_for_delivery") return 3;
  if (status === "delivered") return 3;
  return 0;
}

interface ExistingReview {
  rating: number;
  text: string | null;
  createdAt: string;
}

export function OrderTracking({
  tenantSlug,
  tenantName,
  order: initialOrder,
  canReview = false,
  existingReview = null,
  showTracking = false,
}: {
  tenantSlug: string;
  tenantName: string;
  order: OrderData;
  canReview?: boolean;
  existingReview?: ExistingReview | null;
  showTracking?: boolean;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [review, setReview] = useState<ExistingReview | null>(existingReview);
  const stage = stageOf(order.status);
  const isDelivered = order.status === "delivered";
  // "Just placed" — the customer just landed on this page. Render the
  // celebratory green-check confirmation instead of the ETA so they
  // know the order went through.
  const isJustPlaced = order.status === "pending";

  // SSE updates — only relevant when the merchant opted into live tracking.
  // For the lite thank-you screen, the page never refreshes (less work, less
  // server load, and the customer doesn't expect a live timeline).
  useEffect(() => {
    if (!showTracking) return;
    const es = new EventSource(`/api/v1/realtime/orders/${order.id}`);
    es.addEventListener("snapshot", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { status: string };
        setOrder((prev) => ({ ...prev, status: d.status }));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("status_changed", () => {
      void fetch(`/api/v1/customer/orders/${order.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.order) {
            const o = data.order;
            setOrder((prev) => ({
              ...prev,
              status: o.status,
              readyAt: o.ready_at,
              deliveredAt: o.delivered_at,
              confirmedAt: o.confirmed_at,
            }));
          }
        })
        .catch(() => {});
    });
    return () => es.close();
  }, [order.id, showTracking]);

  // E-commerce style: clean "thank you" receipt, no ETA hero, no live
  // step timeline, no branch contact card. Merchants get this by default;
  // they can flip the switch in Settings → Checkout to opt into the full
  // tracking experience instead.
  if (!showTracking) {
    return (
      <ThankYouView
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        order={order}
        canReview={canReview}
        review={review}
        onReviewSubmitted={setReview}
      />
    );
  }

  return (
    <div className="pb-20 lg:max-w-2xl lg:mx-auto lg:pt-6 lg:pb-12">
      <header className="bg-linear-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-8 rounded-b-3xl lg:rounded-3xl lg:px-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white/15 grid place-items-center lg:hidden"
            aria-label="חזרה"
          >
            <IcoChev c="#fff" s={18} />
          </Link>
          <div className="font-mono text-sm">#{order.number}</div>
        </div>
        <div className="text-center">
          {isJustPlaced ? (
            <>
              <div
                className="mx-auto w-20 h-20 rounded-full bg-white grid place-items-center shadow-lg animate-qf-check-in"
                aria-hidden
              >
                <IcoCheck c="#16a34a" s={44} />
              </div>
              <div className="text-2xl font-bold mt-4">תודה על ההזמנה!</div>
              <div className="text-sm mt-1 opacity-90">
                ההזמנה אצל {tenantName} — תקבל עדכון ברגע שהיא תיכנס להכנה
              </div>
            </>
          ) : isDelivered ? (
            <>
              <div className="text-5xl font-bold tnum grid place-items-center">
                <IcoCheck c="currentColor" s={48} />
              </div>
              <div className="text-sm mt-1 opacity-85">נמסר בהצלחה</div>
            </>
          ) : (
            <>
              <div className="text-5xl font-bold tnum">25–35</div>
              <div className="text-sm mt-1 opacity-85">דקות עד להגעה משוערת</div>
            </>
          )}
        </div>
      </header>

      {/* Status card */}
      <section className="px-5 -mt-3 lg:px-0 lg:mt-6">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-4 shadow-sm">
          <div>
            <div className="font-semibold">{STAGES[stage]?.label}</div>
            <div className="text-xs text-qf-mute">
              {order.status === "preparing" && "המסעדה התחילה להכין את ההזמנה שלך"}
              {order.status === "ready" &&
                (order.method === "pickup" ? "מוכן לאיסוף" : "מחכה לשליח")}
              {order.status === "out_for_delivery" && "השליח בדרך אליך"}
              {order.status === "delivered" && "תודה רבה ובתיאבון!"}
            </div>
          </div>

          {/* Progress steps */}
          <ol className="grid grid-cols-4 gap-2">
            {STAGES.map((s, idx) => {
              const done = idx <= stage;
              return (
                <li key={s.key} className="text-center">
                  <div
                    className={cn(
                      "mx-auto w-7 h-7 rounded-full grid place-items-center transition",
                      done ? "bg-(--qf-primary) text-white" : "bg-qf-line-soft text-qf-mute",
                    )}
                  >
                    {done ? <IcoCheck c="#fff" s={14} /> : <span className="text-xs">{idx + 1}</span>}
                  </div>
                  <div className={cn("text-[10px] mt-1", done ? "text-qf-ink" : "text-qf-mute")}>
                    {s.label}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="pt-3 border-t border-qf-line-soft space-y-1.5 text-xs text-qf-mute">
            {order.confirmedAt && (
              <Timestamp icon label="אושרה" t={order.confirmedAt} />
            )}
            {order.readyAt && <Timestamp icon label="מוכנה" t={order.readyAt} />}
            {order.deliveredAt && (
              <Timestamp icon label="נמסרה" t={order.deliveredAt} />
            )}
          </div>
        </div>
      </section>

      {/* Branch contact */}
      {order.branch && (
        <section className="px-5 mt-4 lg:px-0">
          <div className="bg-white rounded-2xl border border-qf-line p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-qf-green-soft grid place-items-center text-(--qf-deep) font-bold text-base">
              {tenantName.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{tenantName}</div>
              <div className="text-xs text-qf-mute truncate">{order.branch.address}</div>
            </div>
            <a
              href={`tel:${order.branch.phone}`}
              className="px-3 py-1.5 rounded-full bg-qf-green-soft text-(--qf-deep) text-xs font-medium flex items-center gap-1.5"
              dir="ltr"
            >
              <IcoPhone c="var(--qf-deep)" s={12} />
              <span>{order.branch.phone}</span>
            </a>
          </div>
        </section>
      )}

      {/* Review prompt — only after delivery, only for the order's owner */}
      {isDelivered && canReview && (
        <section className="px-5 mt-4 lg:px-0 lg:mt-6" id="review">
          <ReviewCard
            orderId={order.id}
            items={order.items}
            review={review}
            onSubmitted={(r) => setReview(r)}
          />
        </section>
      )}

      {/* Items */}
      <section className="px-5 mt-4 lg:px-0">
        <h2 className="font-semibold mb-2">פירוט ההזמנה</h2>
        <div className="bg-white rounded-2xl border border-qf-line divide-y divide-qf-line-soft">
          {order.items.map((it) => (
            <div key={it.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                {it.size && <div className="text-xs text-qf-mute">{it.size}</div>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-qf-mute text-xs tnum">×{it.quantity}</div>
                <div className="font-medium tnum">{formatPrice(it.total)}</div>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 flex items-center justify-between text-sm font-semibold">
            <div>סה״כ</div>
            <div className="tnum">{formatPrice(order.total)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Timestamp({ icon, label, t }: { icon?: boolean; label: string; t: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <IcoClock c="#7c8a82" s={12} />}
      <span>{label}</span>
      <span className="tnum">· {formatTime(t)}</span>
    </div>
  );
}

function ReviewCard({
  orderId,
  items,
  review,
  onSubmitted,
}: {
  orderId: string;
  items: OrderData["items"];
  review: ExistingReview | null;
  onSubmitted: (r: ExistingReview) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [itemTexts, setItemTexts] = useState<Record<string, string>>({});
  const [expandItem, setExpandItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already reviewed → read-only thank-you state.
  if (review) {
    return (
      <div className="bg-white rounded-2xl border border-qf-line p-4">
        <div className="text-sm font-semibold mb-2">תודה על הדירוג שלך</div>
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <IcoStar
              key={n}
              s={20}
              c={n <= review.rating ? "#f5a524" : "#d4d4d4"}
              fill={n <= review.rating ? "#f5a524" : "none"}
            />
          ))}
        </div>
        {review.text && (
          <p className="text-sm text-qf-ink2 leading-relaxed">{review.text}</p>
        )}
      </div>
    );
  }

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    setError(null);
    try {
      const perItem = Object.entries(itemRatings)
        .filter(([, r]) => r > 0)
        .map(([order_item_id, r]) => ({
          order_item_id,
          rating: r,
          text: itemTexts[order_item_id]?.trim() || null,
        }));
      const res = await fetch(`/api/v1/customer/orders/${orderId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          text: text.trim() || null,
          items: perItem.length ? perItem : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "שגיאה בשליחת הדירוג");
        return;
      }
      onSubmitted({
        rating: data.review.rating,
        text: data.review.text,
        createdAt: data.review.created_at,
      });
    } catch {
      setError("שגיאה בשליחת הדירוג");
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;

  return (
    <div className="bg-white rounded-2xl border border-qf-line p-4">
      <div className="text-base font-semibold">איך הייתה ההזמנה?</div>
      <p className="text-xs text-qf-mute mt-0.5 mb-3">הדירוג עוזר למסעדה להשתפר</p>

      <div
        className="flex items-center gap-1 mb-3"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} כוכבים`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="p-1 -m-1"
          >
            <IcoStar
              s={32}
              c={n <= shown ? "#f5a524" : "#d4d4d4"}
              fill={n <= shown ? "#f5a524" : "none"}
            />
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ספר/י עוד (לא חובה)"
        rows={3}
        maxLength={1000}
        className="w-full bg-qf-bg/60 border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary) resize-none"
      />

      {items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-qf-line-soft">
          <div className="text-sm font-medium mb-2">דירוג למוצרים (לא חובה)</div>
          <div className="space-y-2">
            {items.map((it) => {
              const r = itemRatings[it.id] ?? 0;
              const isOpen = expandItem === it.id;
              return (
                <div
                  key={it.id}
                  className="rounded-xl border border-qf-line-soft px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      {it.size && (
                        <div className="text-xs text-qf-mute">{it.size}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-label={`${it.name}: ${n} כוכבים`}
                          onClick={() =>
                            setItemRatings((prev) => ({
                              ...prev,
                              [it.id]: prev[it.id] === n ? 0 : n,
                            }))
                          }
                          className="p-0.5"
                        >
                          <IcoStar
                            s={18}
                            c={n <= r ? "#f5a524" : "#d4d4d4"}
                            fill={n <= r ? "#f5a524" : "none"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  {r > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandItem(isOpen ? null : it.id)}
                      className="mt-1 text-xs text-(--qf-deep) underline"
                    >
                      {isOpen ? "סגור הערה" : "הוסף הערה"}
                    </button>
                  )}
                  {r > 0 && isOpen && (
                    <textarea
                      value={itemTexts[it.id] ?? ""}
                      onChange={(e) =>
                        setItemTexts((prev) => ({ ...prev, [it.id]: e.target.value }))
                      }
                      placeholder="מה עבד או לא עבד במנה הזו?"
                      rows={2}
                      maxLength={500}
                      className="mt-2 w-full bg-qf-bg/60 border border-qf-line rounded-lg px-3 py-2 text-xs outline-none focus:border-(--qf-primary) resize-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={rating < 1 || busy}
        className="mt-3 w-full py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium text-sm disabled:opacity-60"
      >
        {busy ? "שולח..." : "שליחת דירוג"}
      </button>
    </div>
  );
}

/**
 * E-commerce style post-order confirmation. Shown when the merchant has the
 * "show order tracking" toggle off (the default) in Settings → Checkout.
 *
 * Goal: feel like the thank-you page on any decent online store — clear
 * confirmation, order number, receipt, and a path back to shopping or to
 * the restaurant. NO live ETA, NO step timeline, NO SSE refresh.
 */
function ThankYouView({
  tenantSlug,
  tenantName,
  order,
  canReview,
  review,
  onReviewSubmitted,
}: {
  tenantSlug: string;
  tenantName: string;
  order: OrderData;
  canReview: boolean;
  review: ExistingReview | null;
  onReviewSubmitted: (r: ExistingReview) => void;
}) {
  return (
    <div className="pb-20 lg:pb-12 lg:max-w-2xl lg:mx-auto pt-14 lg:pt-12">
      <section className="px-5 text-center">
        <div
          className="mx-auto w-20 h-20 rounded-full bg-qf-green-soft grid place-items-center shadow-sm animate-qf-check-in"
          aria-hidden
        >
          <IcoCheck c="var(--qf-primary)" s={44} />
        </div>
        <h1 className="text-2xl font-bold mt-5">תודה על ההזמנה!</h1>
        <p className="text-sm text-qf-mute mt-1">
          קיבלנו את ההזמנה שלך אצל {tenantName}.
        </p>
        <div className="mt-4 inline-flex items-baseline gap-2 bg-white border border-qf-line rounded-full px-4 py-2">
          <span className="text-xs text-qf-mute">מספר הזמנה</span>
          {/* In RTL `#PV-5037` reads with the # next to the end of the
              token. Render the number first, then a leading # before it,
              so it sits on the visually-leading side of the code. */}
          <span className="font-bold tnum text-sm" dir="ltr">
            #{order.number}
          </span>
        </div>
      </section>

      {/* Receipt */}
      <section className="px-5 mt-6">
        <div className="bg-white rounded-2xl border border-qf-line overflow-hidden">
          <header className="px-4 py-3 flex items-center justify-between border-b border-qf-line-soft">
            <h2 className="font-semibold text-sm">פירוט ההזמנה</h2>
            <span className="text-xs text-qf-mute">
              {order.method === "delivery" ? "משלוח" : "איסוף"}
            </span>
          </header>
          {/* Column labels — small caps, dimmed, only here to anchor the
              right-hand numbers (כמות + מחיר) the user expected. */}
          <div className="px-4 pt-3 pb-1 flex items-center gap-3 text-[10px] uppercase tracking-wide text-qf-mute">
            <div className="w-14 shrink-0" />
            <div className="flex-1">מוצר</div>
            <div className="w-12 text-center">כמות</div>
            <div className="w-16 text-end">מחיר</div>
          </div>
          <ul className="divide-y divide-qf-line-soft">
            {order.items.map((it) => (
              <li
                key={it.id}
                className="px-4 py-3 flex items-center gap-3 text-sm"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <MenuItemImage
                    src={it.imageUrl ?? null}
                    alt={it.name}
                    businessType={order.businessType}
                    size={56}
                    rounded="xl"
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  {it.size && <div className="text-xs text-qf-mute">{it.size}</div>}
                </div>
                <div className="w-12 text-center text-qf-mute text-xs tnum">
                  ×{it.quantity}
                </div>
                <div className="w-16 text-end font-medium tnum">
                  {formatPrice(it.total)}
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 border-t border-qf-line-soft flex items-center justify-between text-sm font-semibold">
            <div>סה״כ ששולם</div>
            <div className="tnum text-base">{formatPrice(order.total)}</div>
          </div>
        </div>
      </section>

      {/* Review prompt — exact same component as the tracking view */}
      {order.status === "delivered" && canReview && (
        <section className="px-5 mt-4" id="review">
          <ReviewCard
            orderId={order.id}
            items={order.items}
            review={review}
            onSubmitted={onReviewSubmitted}
          />
        </section>
      )}

      {/* Footer CTAs */}
      <section className="px-5 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Link
          href={`/${tenantSlug}`}
          className="text-center py-3 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium text-sm"
        >
          חזרה לחנות
        </Link>
        <Link
          href={`/${tenantSlug}/menu`}
          className="text-center py-3 rounded-2xl border border-qf-line bg-white hover:bg-qf-line-soft text-qf-ink font-medium text-sm"
        >
          הזמנה נוספת
        </Link>
      </section>
    </div>
  );
}
