"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoArrowLeft, IcoCheck, IcoClock, IcoChev } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { readRecentOrderIds } from "@/lib/recent-orders-storage";
import { saveCheckoutPrefill, type CheckoutPrefill } from "@/lib/checkout-prefill";
import { cn } from "@/lib/cn";

interface RecentOrder {
  id: string;
  number: string;
  total: number;
  status: string;
  created_at: string;
  item_count: number;
  headline_item: string | null;
  headline_image: string | null;
}

interface RebuildIssue {
  kind: "item_missing" | "item_unavailable" | "size_missing" | "option_missing";
  name: string;
}

interface RebuildLine {
  itemId: string;
  name: string;
  basePrice: number;
  artType: string | null;
  imageUrl: string | null;
  quantity: number;
  sizeId: string | null;
  sizeName: string | null;
  sizeDelta: number;
  options: Array<{ groupId: string; optionId: string; name: string; priceDelta: number }>;
  notes: string | null;
}

interface RebuildPricing {
  oldSubtotal: number;
  newSubtotal: number;
  delta: number;
}

type ConfirmState = {
  issues: RebuildIssue[];
  pricing: RebuildPricing | null;
} | null;

interface Props {
  tenantSlug: string;
  businessType: BusinessType;
  /** Server-rendered initial list — used when the customer is logged in.
   *  Guests get [] and we hydrate from localStorage on the client. */
  initialOrders: RecentOrder[];
  /** True if the customer is logged in. Skips the localStorage path. */
  hasCustomerSession: boolean;
}

export function ReorderRail({
  tenantSlug,
  businessType,
  initialOrders,
  hasCustomerSession,
}: Props) {
  const router = useRouter();
  const { addMany } = useCart();
  const [orders, setOrders] = useState<RecentOrder[]>(initialOrders);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready">(
    hasCustomerSession ? "ready" : "idle",
  );
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  // Guest path: read localStorage ids on mount, fetch the matching orders.
  useEffect(() => {
    if (hasCustomerSession) return;
    const ids = readRecentOrderIds(tenantSlug);
    if (ids.length === 0) {
      setPhase("ready");
      return;
    }
    setPhase("loading");
    const ctrl = new AbortController();
    fetch(
      `/api/v1/customer/orders/recent?tenant=${encodeURIComponent(tenantSlug)}&ids=${encodeURIComponent(
        ids.join(","),
      )}&limit=3`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((data: { orders?: RecentOrder[] }) => {
        setOrders(data.orders ?? []);
      })
      .catch(() => {
        /* network — silently render empty rail */
      })
      .finally(() => setPhase("ready"));
    return () => ctrl.abort();
  }, [tenantSlug, hasCustomerSession]);

  const handleReorder = useCallback(
    async (orderId: string) => {
      setBusyOrderId(orderId);
      try {
        const res = await fetch(
          `/api/v1/customer/orders/${encodeURIComponent(orderId)}/reorder`,
          { method: "POST" },
        );
        const data = (await res.json()) as {
          lines?: RebuildLine[];
          issues?: RebuildIssue[];
          pricing?: RebuildPricing;
          prefill?: CheckoutPrefill;
        };
        const lines = data.lines ?? [];
        const reportedIssues = data.issues ?? [];
        const pricing = data.pricing ?? null;
        const prefill = data.prefill ?? null;

        if (lines.length > 0) {
          addMany(
            lines.map((l) => ({
              itemId: l.itemId,
              name: l.name,
              basePrice: l.basePrice,
              artType: l.artType,
              imageUrl: l.imageUrl,
              quantity: l.quantity,
              sizeId: l.sizeId,
              sizeName: l.sizeName,
              sizeDelta: l.sizeDelta,
              options: l.options,
              notes: l.notes,
            })),
          );
          // Stash the customer's previous checkout details so /checkout
          // can prefill them on mount — saves them re-typing address,
          // phone, payment, tip, etc.
          if (prefill && Object.keys(prefill).length > 0) {
            saveCheckoutPrefill(tenantSlug, prefill);
          }
        }

        const priceChanged = pricing && pricing.delta !== 0 && lines.length > 0;
        if (reportedIssues.length > 0 || priceChanged) {
          // Surface either the unavailable items, the price change, or both
          // in one modal so the customer makes a single decision.
          setConfirm({
            issues: reportedIssues,
            pricing: priceChanged ? pricing : null,
          });
        } else if (lines.length > 0) {
          router.push(`/${tenantSlug}/cart`);
        }
      } catch {
        setConfirm({
          issues: [{ kind: "item_missing", name: "—" }],
          pricing: null,
        });
      } finally {
        setBusyOrderId(null);
      }
    },
    [addMany, router, tenantSlug],
  );

  const isLoading = phase === "loading";

  if (phase === "ready" && orders.length === 0) {
    return null;
  }

  return (
    <section className="px-5 mt-4 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold">הזמנות קודמות</h2>
        <Link
          href={`/${tenantSlug}/profile`}
          className="text-xs text-(--qf-deep) inline-flex items-center gap-1"
        >
          כל ההזמנות
          <IcoArrowLeft c="currentColor" s={12} />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-live="polite">
          <div className="rounded-2xl bg-white border border-qf-line p-3 flex items-center gap-3 shadow-sm">
            <div className="w-14 h-14 rounded-xl bg-qf-line-soft animate-qf-pulse" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-qf-line-soft animate-qf-pulse" />
              <div className="h-3 w-1/3 rounded bg-qf-line-soft animate-qf-pulse" />
            </div>
            <div className="w-9 h-9 rounded-full bg-qf-line-soft animate-qf-pulse" />
          </div>
          <div className="text-xs text-qf-mute text-center pt-1">טוען הזמנות קודמות...</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <ReorderCard
                order={o}
                businessType={businessType}
                tenantSlug={tenantSlug}
                busy={busyOrderId === o.id}
                onReorder={() => handleReorder(o.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <ReorderConfirmModal
          issues={confirm.issues}
          pricing={confirm.pricing}
          onClose={() => setConfirm(null)}
          onContinue={() => {
            setConfirm(null);
            router.push(`/${tenantSlug}/cart`);
          }}
        />
      )}
    </section>
  );
}

function ReorderCard({
  order,
  businessType,
  tenantSlug,
  busy,
  onReorder,
}: {
  order: RecentOrder;
  businessType: BusinessType;
  tenantSlug: string;
  busy: boolean;
  onReorder: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-qf-line p-3 flex items-center gap-3 shadow-sm">
      <Link
        href={`/${tenantSlug}/orders/${order.id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
          <MenuItemImage
            src={order.headline_image ?? undefined}
            alt={order.headline_item ?? "הזמנה"}
            businessType={businessType}
            size={56}
            rounded="md"
            className="w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-tight truncate">
            {order.headline_item ?? "הזמנה"}
            {order.item_count > 1 ? ` +${order.item_count - 1}` : ""}
          </div>
          <div className="text-xs text-qf-mute mt-0.5 inline-flex items-center gap-1">
            <IcoClock s={11} c="#7c8a82" />
            <RelativeTime date={order.created_at} />
            <span>·</span>
            <span className="tnum">{formatPrice(order.total)}</span>
          </div>
        </div>
        <IcoChev c="#7c8a82" s={16} />
      </Link>
      <button
        type="button"
        onClick={onReorder}
        disabled={busy}
        aria-label={`הזמן שוב — ${order.headline_item ?? "הזמנה"}`}
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 bg-(--qf-primary) text-white text-xs font-semibold rounded-full pr-3 pl-3 h-9 transition active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100",
        )}
      >
        {busy ? (
          <span className="qf-spinner" />
        ) : (
          <>
            <IcoReorder c="#fff" s={14} />
            <span>הזמן שוב</span>
          </>
        )}
      </button>
    </div>
  );
}

function ReorderConfirmModal({
  issues,
  pricing,
  onClose,
  onContinue,
}: {
  issues: RebuildIssue[];
  pricing: RebuildPricing | null;
  onClose: () => void;
  onContinue: () => void;
}) {
  const reasonLabel: Record<RebuildIssue["kind"], string> = {
    item_missing: "כבר לא קיים בתפריט",
    item_unavailable: "אזל כרגע",
    size_missing: "הגודל שבחרת לא זמין",
    option_missing: "אחת התוספות שבחרת לא זמינה",
  };
  const hasIssues = issues.length > 0;
  const priceIncreased = !!pricing && pricing.delta > 0;
  const priceDecreased = !!pricing && pricing.delta < 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qf-reorder-confirm-title"
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 px-4 pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-xl px-5 pt-5 pb-4 animate-qf-check-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-qf-yolk-soft grid place-items-center">
            <IcoCheck c="#92400e" s={20} />
          </div>
          <h3 id="qf-reorder-confirm-title" className="font-bold text-lg">
            שים לב
          </h3>
        </div>

        {pricing && pricing.delta !== 0 && (
          <div className="mb-3 rounded-2xl border border-qf-line bg-qf-line-soft px-3 py-3">
            <div className="text-sm font-medium mb-1">
              {priceIncreased ? "המחיר התעדכן מאז ההזמנה הקודמת" : "המחיר ירד מאז ההזמנה הקודמת"}
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-qf-mute">בעבר</span>
              <span className="tnum text-qf-ink2 line-through">
                {formatPrice(pricing.oldSubtotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-sm mt-0.5">
              <span className="font-medium">עכשיו</span>
              <span
                className={cn(
                  "tnum font-bold",
                  priceIncreased && "text-qf-tomato",
                  priceDecreased && "text-qf-green-deep",
                )}
              >
                {formatPrice(pricing.newSubtotal)}
              </span>
            </div>
            <div className="text-xs text-qf-mute mt-1">
              הפרש: <span className="tnum">{priceIncreased ? "+" : ""}{formatPrice(pricing.delta)}</span>
            </div>
          </div>
        )}

        {hasIssues && (
          <>
            <p className="text-sm text-qf-ink2 mb-3 leading-relaxed">
              ההזמנה לא שוחזרה במלואה. הפריטים הבאים לא נוספו לסל:
            </p>
            <ul className="space-y-2 mb-4 bg-qf-line-soft rounded-2xl p-3 max-h-56 overflow-y-auto">
              {issues.map((issue, idx) => (
                <li key={`${issue.kind}-${idx}`} className="text-sm flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-qf-tomato mt-2 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{issue.name}</div>
                    <div className="text-xs text-qf-mute">{reasonLabel[issue.kind]}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-qf-line text-sm font-medium text-qf-ink2 active:scale-[0.99] transition"
          >
            הישאר כאן
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 h-12 rounded-2xl bg-(--qf-primary) text-white text-sm font-semibold active:scale-[0.99] transition"
          >
            המשך לסל
          </button>
        </div>
      </div>
    </div>
  );
}

function IcoReorder({ c, s }: { c: string; s: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
