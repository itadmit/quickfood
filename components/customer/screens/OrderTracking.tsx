"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoPhone, IcoClock, IcoCheck, IcoStar, IcoWhatsApp } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { readOrderToken } from "@/lib/order-access-storage";

const CourierMap = dynamic(
  () => import("@/components/customer/CourierMap").then((m) => m.CourierMap),
  { ssr: false, loading: () => null },
);

interface OrderItemOption {
  name: string;
  priceDelta: number;
}

interface OrderItemRow {
  id: string;
  name: string;
  quantity: number;
  total: number;
  size: string | null;
  imageUrl: string | null;
  notes: string | null;
  options: OrderItemOption[];
}

interface OrderData {
  id: string;
  number: string;
  status: string;
  method: "delivery" | "pickup";
  total: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  cutleryFee: number;
  tip: number;
  discount: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  branch: { phone: string; address: string } | null;
  deliveryLocation: { lat: number; lng: number } | null;
  courier: {
    name: string;
    phone: string;
    lat: number | null;
    lng: number | null;
  } | null;
  items: OrderItemRow[];
  businessType: BusinessType;
}

const COMMON_STAGES = [
  { key: "received", label: "התקבלה" },
  { key: "preparing", label: "בהכנה" },
  { key: "ready", label: "מוכנה" },
] as const;
const DELIVERY_TAIL = [
  { key: "delivering", label: "בדרך" },
  { key: "delivered", label: "נמסר" },
] as const;
const PICKUP_TAIL = [{ key: "delivered", label: "נאסף" }] as const;

function stagesFor(method: "delivery" | "pickup"): Array<{ key: string; label: string }> {
  return [...COMMON_STAGES, ...(method === "delivery" ? DELIVERY_TAIL : PICKUP_TAIL)];
}

function stageOf(status: string, method: "delivery" | "pickup"): number {
  if (["pending", "confirmed"].includes(status)) return 0;
  if (["preparing", "in_oven"].includes(status)) return 1;
  if (status === "ready") return 2;
  if (method === "delivery") {
    if (status === "out_for_delivery") return 3;
    if (status === "delivered") return 4;
  } else {
    // Pickup skips out_for_delivery entirely.
    if (status === "delivered") return 3;
  }
  return 0;
}

interface ExistingReview {
  rating: number;
  text: string | null;
  createdAt: string;
  replyText: string | null;
  replyAt: string | null;
}

export interface PublicReview {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  authorName: string;
}

export function OrderTracking({
  tenantSlug,
  tenantName,
  tenantLogoUrl = null,
  tenantCoverImage = null,
  recentReviews = [],
  order: initialOrder,
  canReview = false,
  existingReview = null,
  showTracking = false,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  tenantCoverImage?: string | null;
  recentReviews?: PublicReview[];
  order: OrderData;
  canReview?: boolean;
  existingReview?: ExistingReview | null;
  showTracking?: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [review, setReview] = useState<ExistingReview | null>(existingReview);
  const stages = stagesFor(order.method);
  const stage = stageOf(order.status, order.method);
  const isDelivered = order.status === "delivered";
  // "Just placed" - the customer just landed on this page. Render the
  // celebratory green-check confirmation instead of the ETA so they
  // know the order went through.
  const isJustPlaced = order.status === "pending";

  // Same-device review unlock: if the server said "no review form for you"
  // but we stored a token at checkout, re-navigate with ?t= so the page
  // re-renders server-side with canReview=true (and with any existingReview
  // properly hydrated). No-op if the URL already has ?t= or if we have no
  // stored token.
  useEffect(() => {
    if (canReview) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("t")) return;
    const stored = readOrderToken(tenantSlug, order.id);
    if (!stored) return;
    params.set("t", stored);
    router.replace(`${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }, [canReview, order.id, tenantSlug, router]);

  // SSE updates - only relevant when the merchant opted into live tracking.
  // For the lite thank-you screen, the page never refreshes (less work, less
  // server load, and the customer doesn't expect a live timeline).
  useEffect(() => {
    if (!showTracking) return;
    const es = new EventSource(`/api/v1/realtime/orders/${order.id}`);
    es.addEventListener("snapshot", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as {
          status: string;
          courier_name?: string | null;
          courier_phone?: string | null;
          courier_lat?: number | null;
          courier_lng?: number | null;
        };
        setOrder((prev) => ({
          ...prev,
          status: d.status,
          courier:
            d.courier_name || prev.courier
              ? {
                  name: d.courier_name ?? prev.courier?.name ?? "",
                  phone: d.courier_phone ?? prev.courier?.phone ?? "",
                  lat: d.courier_lat ?? prev.courier?.lat ?? null,
                  lng: d.courier_lng ?? prev.courier?.lng ?? null,
                }
              : prev.courier,
        }));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("courier_location", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as {
          lat: number | null;
          lng: number | null;
        };
        setOrder((prev) =>
          prev.courier
            ? { ...prev, courier: { ...prev.courier, lat: d.lat, lng: d.lng } }
            : prev,
        );
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
              courier: o.courier
                ? {
                    name: o.courier.name,
                    phone: o.courier.phone,
                    lat: o.courier.lat ?? null,
                    lng: o.courier.lng ?? null,
                  }
                : prev.courier,
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
        tenantLogoUrl={tenantLogoUrl}
        tenantCoverImage={tenantCoverImage}
        recentReviews={recentReviews}
        order={order}
        canReview={canReview}
        review={review}
        onReviewSubmitted={setReview}
      />
    );
  }

  return (
    <div className="pb-20 lg:max-w-2xl lg:mx-auto lg:pt-6 lg:pb-12">
      <BrandedHeader
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        tenantCoverImage={tenantCoverImage}
        orderNumber={order.number}
        headline={
          isJustPlaced
            ? "תודה על ההזמנה!"
            : isDelivered
              ? "נמסר בהצלחה"
              : "25–35"
        }
        subhead={
          isJustPlaced
            ? `ההזמנה אצל ${tenantName} - תקבל עדכון ברגע שהיא תיכנס להכנה`
            : isDelivered
              ? null
              : "דקות עד להגעה משוערת"
        }
        showCheck={isJustPlaced || isDelivered}
        bigNumber={!isJustPlaced && !isDelivered}
      />

      {/* Status card */}
      <section className="px-5 -mt-3 lg:px-0 lg:mt-6">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-4 shadow-sm">
          <div>
            <div className="font-semibold">{stages[stage]?.label}</div>
            <div className="text-xs text-qf-mute">
              {order.status === "preparing" && "המסעדה התחילה להכין את ההזמנה שלך"}
              {order.status === "ready" &&
                (order.method === "pickup" ? "מוכן לאיסוף" : "מחכה לשליח")}
              {order.status === "out_for_delivery" && "השליח בדרך אליך"}
              {order.status === "delivered" && "תודה רבה ובתיאבון!"}
            </div>
          </div>

          {/* Progress steps - circles connected by a track. The fill grows
              across the connector when the next stage is reached, and the
              currently-active circle gets a soft pulsing ring so the eye
              lands on "where we are right now" without reading the labels. */}
          <ol className="relative flex items-start">
            {stages.map((s, idx) => {
              const done = idx <= stage;
              const isCurrent = idx === stage;
              const lineDone = idx < stage;
              return (
                <li
                  key={s.key}
                  className="flex-1 flex flex-col items-center relative"
                >
                  {/* Connector toward the NEXT step. Anchored at the
                      column center and stretched a full column wide so
                      it lands on the next circle's center. */}
                  {idx < stages.length - 1 && (
                    <div className="absolute top-3.5 inset-s-1/2 w-full h-0.5 -translate-y-1/2 bg-qf-line-soft pointer-events-none overflow-hidden">
                      <div
                        className="h-full bg-(--qf-primary) transition-[width] duration-700 ease-out"
                        style={{ width: lineDone ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                  {/* Pulsing halo on the active stage. animate-ping fades
                      out as it expands, so it reads as a heartbeat. */}
                  {isCurrent && (
                    <div className="absolute top-0 w-7 h-7 rounded-full bg-(--qf-primary)/40 animate-ping pointer-events-none" />
                  )}
                  <div
                    className={cn(
                      "relative z-10 w-7 h-7 rounded-full grid place-items-center transition-colors duration-500",
                      done
                        ? "bg-(--qf-primary) text-white shadow-md"
                        : "bg-qf-line-soft text-qf-mute",
                    )}
                  >
                    {done ? (
                      <IcoCheck c="#fff" s={14} />
                    ) : (
                      <span className="text-xs">{idx + 1}</span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] mt-1 transition-colors",
                      done ? "text-qf-ink font-medium" : "text-qf-mute",
                    )}
                  >
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

      {/* Courier card + live map */}
      {order.courier &&
        (order.status === "out_for_delivery" || order.status === "ready") && (
          <section className="px-5 mt-4 lg:px-0 space-y-3">
            <div className="bg-white rounded-2xl border border-qf-line p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-qf-green-soft grid place-items-center text-(--qf-deep) font-bold text-base">
                {order.courier.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{order.courier.name}</div>
                <div className="text-xs text-qf-mute">השליח שלך</div>
              </div>
              {order.courier.phone && (
                <a
                  href={`tel:${order.courier.phone}`}
                  className="px-3 py-1.5 rounded-full bg-qf-green-soft text-(--qf-deep) text-xs font-medium flex items-center gap-1.5"
                  dir="ltr"
                >
                  <IcoPhone c="var(--qf-deep)" s={12} />
                  <span>{order.courier.phone}</span>
                </a>
              )}
            </div>
            {(order.courier.lat || order.deliveryLocation) && (
              <CourierMap
                courier={
                  order.courier.lat && order.courier.lng
                    ? { lat: order.courier.lat, lng: order.courier.lng }
                    : null
                }
                customer={order.deliveryLocation}
              />
            )}
          </section>
        )}

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

      {/* Review prompt - only after delivery, only for the order's owner */}
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
            <div
              key={it.id}
              className="px-4 py-3 flex items-center gap-3 text-sm"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                <MenuItemImage
                  src={it.imageUrl ?? null}
                  alt={it.name}
                  businessType={order.businessType}
                  size={40}
                  rounded="xl"
                  className="w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-qf-mute text-xs tnum shrink-0">
                    ×{it.quantity}
                  </div>
                </div>
                {it.size && (
                  <div className="text-xs text-qf-mute">{it.size}</div>
                )}
              </div>
              <div className="font-medium tnum shrink-0">
                {formatPrice(it.total)}
              </div>
            </div>
          ))}
          <div className="px-4 py-3 flex items-center justify-between text-sm font-semibold">
            <div>סה״כ</div>
            <div className="tnum">{formatPrice(order.total)}</div>
          </div>
        </div>
      </section>

      {/* Share + social proof - surface even on the live-tracking view so
          the customer can forward the link to whoever's picking up. */}
      {!isDelivered && (
        <section className="px-5 mt-4 lg:px-0">
          <ShareCTA
            tenantName={tenantName}
            orderNumber={order.number}
            method={order.method}
          />
        </section>
      )}

      {recentReviews.length > 0 && (
        <section className="px-5 mt-4 lg:px-0">
          <ReviewsTeaser
            tenantName={tenantName}
            reviews={recentReviews}
          />
        </section>
      )}

      {/* Footer - single primary CTA, same shape as the ThankYouView. */}
      <section className="px-5 mt-6 lg:px-0">
        <Link
          href={`/s/${tenantSlug}#menu-section`}
          className="block text-center py-3 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium text-sm"
        >
          הזמנה חדשה
        </Link>
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

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        muted ? "text-qf-mute" : "text-qf-ink2"
      }`}
    >
      <div>{label}</div>
      <div className="tnum">{formatPrice(value)}</div>
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

  // Already reviewed → read-only thank-you state. If the merchant replied,
  // surface their response in a highlighted block - same shape as the
  // public reviews page.
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
        {review.replyText && (
          <div className="mt-3 bg-qf-green-soft border-s-4 border-(--qf-primary) rounded-e-lg ps-3 py-2 text-sm">
            <div className="text-xs text-qf-green-deep font-medium">תשובת המסעדה</div>
            <div className="mt-0.5 text-qf-ink2 leading-relaxed">{review.replyText}</div>
          </div>
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
      // Forward the access token (from email link or localStorage flip) so
      // a customer without an OTP session can still submit their rating.
      const urlToken = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      ).get("t");
      const qs = urlToken ? `?t=${encodeURIComponent(urlToken)}` : "";
      const res = await fetch(`/api/v1/customer/orders/${orderId}/review${qs}`, {
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
        replyText: data.review.reply_text ?? null,
        replyAt: data.review.reply_at ?? null,
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
 * Goal: feel like the thank-you page on any decent online store - clear
 * confirmation, order number, receipt, and a path back to shopping or to
 * the restaurant. NO live ETA, NO step timeline, NO SSE refresh.
 */
function ThankYouView({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
  tenantCoverImage,
  recentReviews,
  order,
  canReview,
  review,
  onReviewSubmitted,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantCoverImage: string | null;
  recentReviews: PublicReview[];
  order: OrderData;
  canReview: boolean;
  review: ExistingReview | null;
  onReviewSubmitted: (r: ExistingReview) => void;
}) {
  // Same URL serves three intents - pick the framing that fits.
  //  - "review": delivered + can rate + hasn't yet → the review form is the
  //    protagonist (this is what email-reminder lands on)
  //  - "thanks_for_review": delivered + already rated → quiet acknowledgment
  //  - "thank_you": just placed (or anything not delivered) → celebratory
  const mode: "review" | "thanks_for_review" | "thank_you" =
    order.status === "delivered" && canReview
      ? review
        ? "thanks_for_review"
        : "review"
      : "thank_you";

  const headerProps =
    mode === "review"
      ? {
          headline: "איך הייתה ההזמנה?",
          subhead: `נשמח לשמוע איך היה אצל ${tenantName}`,
          showCheck: false,
        }
      : mode === "thanks_for_review"
      ? {
          headline: "תודה על הדירוג!",
          subhead: `הרושם שלך עוזר ל${tenantName} להשתפר`,
          showCheck: true,
        }
      : {
          headline: "תודה על ההזמנה!",
          subhead: `קיבלנו את ההזמנה שלך אצל ${tenantName}`,
          showCheck: true,
        };

  const reviewSection = order.status === "delivered" && canReview && (
    <section className="px-5 mt-6 lg:px-0" id="review">
      <ReviewCard
        orderId={order.id}
        items={order.items}
        review={review}
        onSubmitted={onReviewSubmitted}
      />
    </section>
  );

  const itemsSection = (
    <section className="px-5 mt-4 lg:px-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">פירוט ההזמנה</h2>
        <span className="text-xs text-qf-mute">
          {order.method === "delivery" ? "משלוח" : "איסוף"}
        </span>
      </div>
      <div className="bg-white rounded-2xl border border-qf-line divide-y divide-qf-line-soft">
        {order.items.map((it) => (
          <div
            key={it.id}
            className="px-4 py-3 flex items-start gap-3 text-sm"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
              <MenuItemImage
                src={it.imageUrl ?? null}
                alt={it.name}
                businessType={order.businessType}
                size={40}
                rounded="xl"
                className="w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                <div className="text-qf-mute text-xs tnum shrink-0">
                  ×{it.quantity}
                </div>
              </div>
              {it.size && (
                <div className="text-xs text-qf-mute">{it.size}</div>
              )}
              {it.options.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {it.options.map((o, i) => (
                    <li
                      key={i}
                      className="text-xs text-qf-mute flex items-center gap-1"
                    >
                      <span>+ {o.name}</span>
                      {o.priceDelta > 0 && (
                        <span className="tnum">({formatPrice(o.priceDelta)})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {it.notes && (
                <div className="mt-1 text-xs text-qf-yolk-deep">
                  הערה: {it.notes}
                </div>
              )}
            </div>
            <div className="font-medium tnum shrink-0">
              {formatPrice(it.total)}
            </div>
          </div>
        ))}
        <div className="px-4 py-3 space-y-1 text-sm">
          <SummaryRow label="פריטים" value={order.subtotal} />
          {order.deliveryFee > 0 && (
            <SummaryRow label="דמי משלוח" value={order.deliveryFee} />
          )}
          {order.serviceFee > 0 && (
            <SummaryRow label="דמי שירות" value={order.serviceFee} />
          )}
          {order.cutleryFee > 0 && (
            <SummaryRow label="סכו״ם" value={order.cutleryFee} />
          )}
          {order.tip > 0 && (
            <SummaryRow label="טיפ לשליח" value={order.tip} />
          )}
          {order.discount > 0 && (
            <SummaryRow label="הנחה" value={-order.discount} muted />
          )}
          <div className="pt-1 mt-1 border-t border-qf-line-soft flex items-center justify-between font-semibold text-base">
            <div>סה״כ ששולם</div>
            <div className="tnum">{formatPrice(order.total)}</div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="pb-20 lg:pb-12 lg:max-w-2xl lg:mx-auto">
      <BrandedHeader
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        tenantCoverImage={tenantCoverImage}
        orderNumber={order.number}
        bigNumber={false}
        {...headerProps}
      />

      {/* In review mode, the rating form is the reason the customer is
          here - surface it directly under the header, push the receipt
          down as reference, and drop the social-proof noise. */}
      {mode === "review" ? (
        <>
          {reviewSection}
          {itemsSection}
        </>
      ) : mode === "thanks_for_review" ? (
        <>
          {reviewSection}
          {itemsSection}
        </>
      ) : (
        <>
          {itemsSection}

          {/* Share - surface above the review prompt because most customers
              hit this page right after paying, well before delivery. */}
          {order.status !== "delivered" && (
            <section className="px-5 mt-4">
              <ShareCTA
                tenantName={tenantName}
                orderNumber={order.number}
                method={order.method}
              />
            </section>
          )}

          {/* Social proof - recent positive reviews from other customers.
              Only when we're NOT in review-mode (it's noise on a page
              whose whole point is the customer's own rating). */}
          {recentReviews.length > 0 && (
            <section className="px-5 mt-4">
              <ReviewsTeaser tenantName={tenantName} reviews={recentReviews} />
            </section>
          )}
        </>
      )}

      <section className="px-5 mt-6">
        <Link
          href={`/s/${tenantSlug}#menu-section`}
          className="block text-center py-3 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium text-sm"
        >
          הזמנה חדשה
        </Link>
      </section>
    </div>
  );
}

/**
 * Hero block at the top of the order page - cover image as the background
 * (with a dim gradient so foreground text stays readable), the tenant's
 * logo as a floating circular badge bottom-overlapping the next block, and
 * the business name + order number stamped under it. Falls back to the
 * brand gradient if no cover image is set.
 */
function BrandedHeader({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
  tenantCoverImage,
  orderNumber,
  headline,
  subhead,
  showCheck,
  bigNumber,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantCoverImage: string | null;
  orderNumber: string;
  headline: string;
  subhead: string | null;
  showCheck: boolean;
  bigNumber: boolean;
}) {
  const initial = tenantName.slice(0, 1);

  return (
    <header className="relative">
      <div
        className="relative px-5 pt-5 pb-16 text-white overflow-hidden lg:rounded-3xl lg:mx-0"
        style={
          tenantCoverImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%), url(${tenantCoverImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* Fallback gradient when no cover is set - same brand wash the
            page used before this refactor. */}
        {!tenantCoverImage && (
          <div
            className="absolute inset-0 bg-linear-to-b from-(--qf-primary) to-(--qf-deep)"
            aria-hidden
          />
        )}

        <div className="relative flex items-center justify-start mb-6 h-9">
          <div
            className="font-mono text-sm bg-black/25 backdrop-blur-sm rounded-full px-3 py-1"
            dir="ltr"
          >
            #{orderNumber}
          </div>
        </div>

        <div className="relative text-center">
          {showCheck && (
            <div
              className="mx-auto w-20 h-20 rounded-full bg-white grid place-items-center shadow-lg animate-qf-check-in mb-4"
              aria-hidden
            >
              <IcoCheck c="#16a34a" s={44} />
            </div>
          )}
          {bigNumber ? (
            <div className="text-5xl font-bold tnum">{headline}</div>
          ) : (
            <div className="text-2xl font-bold">{headline}</div>
          )}
          {subhead && (
            <div className="text-sm mt-1 opacity-90">{subhead}</div>
          )}
        </div>
      </div>

      {/* Floating logo + business name strip - sits at the seam between the
          cover and the content below, so the cover frames a clear identity
          chip instead of bleeding straight into a generic receipt. */}
      <div className="relative -mt-8 px-5 lg:px-0">
        <div className="bg-white rounded-2xl border border-qf-line shadow-sm px-4 py-3 flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full border-2 border-white overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            style={{ backgroundColor: "var(--qf-primary)" }}
          >
            {tenantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenantLogoUrl}
                alt={tenantName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-lg">{initial}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{tenantName}</div>
            <Link
              href={`/s/${tenantSlug}`}
              className="text-xs text-qf-mute hover:text-(--qf-deep) underline-offset-2 hover:underline"
            >
              לחנות
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * "Share with whoever's picking up" - WhatsApp deep-link plus native Web
 * Share fallback for iOS/Android. The text the receiver gets is short and
 * carries the tracking link so they can follow status without logging in.
 */
function ShareCTA({
  tenantName,
  orderNumber,
  method,
}: {
  tenantName: string;
  orderNumber: string;
  method: "delivery" | "pickup";
}) {
  function currentUrl(): string {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }

  function shareMessage(): string {
    return `הזמנתי מ-${tenantName} (הזמנה #${orderNumber}). אפשר לעקוב אחרי הסטטוס פה: ${currentUrl()}`;
  }

  function onWhatsApp() {
    const text = encodeURIComponent(shareMessage());
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  async function onNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      onWhatsApp();
      return;
    }
    try {
      await navigator.share({
        title: `הזמנה אצל ${tenantName}`,
        text: shareMessage(),
        url: currentUrl(),
      });
    } catch {
      /* user dismissed the sheet - nothing to do */
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-qf-line p-4">
      <div className="font-semibold text-sm">
        {method === "delivery"
          ? "עוד מישהו מחכה להזמנה?"
          : "מישהו אחר צריך לאסוף את ההזמנה?"}
      </div>
      <p className="text-xs text-qf-mute mt-0.5 mb-3">
        שתפו אותו בקלות בסטטוס ההזמנה.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onWhatsApp}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1FB955] text-white font-medium text-sm transition"
        >
          <IcoWhatsApp c="#fff" s={18} />
          <span>שיתוף בוואטסאפ</span>
        </button>
        <button
          type="button"
          onClick={onNativeShare}
          className="flex-1 py-2.5 rounded-xl border border-qf-line bg-white hover:bg-qf-line-soft text-qf-ink font-medium text-sm transition"
        >
          שיתוף אחר
        </button>
      </div>
    </div>
  );
}

/**
 * Carousel of the latest visible reviews (≥4 stars, with a body) so the
 * customer who just paid sees other satisfied buyers as the order is on
 * its way. Read-only - submitting goes through ReviewCard below.
 */
function ReviewsTeaser({
  tenantName,
  reviews,
}: {
  tenantName: string;
  reviews: PublicReview[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-qf-line p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm">מה אומרים על {tenantName}</div>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="rounded-xl bg-qf-bg/60 border border-qf-line-soft px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-xs font-medium text-qf-ink truncate">
                {r.authorName}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5].map((n) => (
                  <IcoStar
                    key={n}
                    s={12}
                    c={n <= r.rating ? "#f5a524" : "#d4d4d4"}
                    fill={n <= r.rating ? "#f5a524" : "none"}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-qf-ink2 leading-relaxed line-clamp-3">
              {r.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
