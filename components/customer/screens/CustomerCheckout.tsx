"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev, IcoArrowLeft, IcoBag } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { recordRecentOrder } from "@/lib/recent-orders-storage";
import { takeCheckoutPrefill } from "@/lib/checkout-prefill";
import { GrowPaymentSdk, renderGrowWallet } from "@/components/customer/GrowPaymentSdk";

type CustomerPaymentMethod = "cash" | "card" | "bit" | "apple_pay" | "google_pay";

const PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  cash: "מזומן בעת המסירה",
  card: "כרטיס אשראי",
  bit: "Bit",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export function CustomerCheckout({
  tenantSlug,
  requireEmail = false,
  growEnabled = false,
  growTestMode = true,
}: {
  tenantSlug: string;
  requireEmail?: boolean;
  growEnabled?: boolean;
  growTestMode?: boolean;
}) {
  const router = useRouter();
  const { lines, method, subtotal, branch, tenant, clear, setMethod, hydrated } = useCart();

  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [availableMethods, setAvailableMethods] = useState<CustomerPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schedule-for-later. asap = deliver as soon as possible (the default);
  // scheduledTime is a "HH:mm" string for today only (no multi-day picker
  // for V1 — the most common use is "אסוף בעוד שעתיים" / "תספיק להגיע
  // בשמונה"). The merchant's open hours could be enforced server-side
  // later; for now we just let the merchant decline if it's outside hours.
  const [scheduledTime, setScheduledTime] = useState<string>("");
  // Once the user taps "תזמן" we reveal the slot row even before they pick
  // a specific time. Without this the only signal of "schedule mode" would
  // be a non-empty scheduledTime, so the user can't browse slots without
  // committing to one.
  const [showSlots, setShowSlots] = useState(false);

  // Coupon. couponCode is what the user typed; couponApplied is the result
  // of the last successful /coupons/validate call. They're separate so the
  // user can edit the code without losing the active discount until they
  // re-apply.
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<
    | { code: string; discount: number; message: string }
    | null
  >(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  // True once the POST /orders call has succeeded — even though we clear()
  // the cart immediately afterward, this stays true until the browser
  // finishes navigating to /orders/[id], so we can show a "processing"
  // screen instead of the "הסל ריק" empty-state flashing for ~250ms.
  const [submitted, setSubmitted] = useState(false);

  // Grow SDK orchestration. The SDK only loads/initializes when there's an
  // active pending payment, and the wallet is rendered once both the SDK is
  // ready and we have an authCode from /pay/initiate. We also receive the
  // `testMode` flag from the server so the SDK's environment matches the
  // mode the authCode was issued under (sandbox vs production).
  const [pendingPayment, setPendingPayment] = useState<
    | { orderId: string; authCode: string; thankYouUrl: string; testMode: boolean }
    | null
  >(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  useEffect(() => {
    if (pendingPayment && sdkReady) {
      renderGrowWallet(pendingPayment.authCode);
    }
  }, [pendingPayment, sdkReady]);

  // Load the restaurant's accepted payment methods. The server returns
  // them in the merchant's chosen order (defaultPaymentMethod first),
  // so we just pick the first one as the initial selection. If a
  // prefill from "הזמן שוב" already picked a method, we keep it as long
  // as it's still allowed.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/restaurants/${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((d: { restaurant?: { payment_methods?: CustomerPaymentMethod[] } }) => {
        if (cancelled) return;
        const methods = d.restaurant?.payment_methods ?? [];
        setAvailableMethods(methods);
        const first = methods[0] ?? null;
        setPaymentMethod((cur) => (cur && methods.includes(cur) ? cur : first));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // Consume any "הזמן שוב" prefill the home rail dropped in sessionStorage
  // on mount. takeCheckoutPrefill() clears the entry so a refresh doesn't
  // replay it. Each field is only applied if the customer hasn't already
  // typed something — we never clobber active edits.
  useEffect(() => {
    const prefill = takeCheckoutPrefill(tenantSlug);
    if (!prefill) return;
    if (prefill.firstName) setFirstName((cur) => cur || prefill.firstName!);
    if (prefill.lastName) setLastName((cur) => cur || prefill.lastName!);
    if (prefill.phone) setPhone((cur) => cur || prefill.phone!);
    if (prefill.address) setAddress((cur) => cur || prefill.address!);
    if (prefill.floor) setFloor((cur) => cur || prefill.floor!);
    if (prefill.apartment) setApartment((cur) => cur || prefill.apartment!);
    if (prefill.deliveryNotes)
      setDeliveryNotes((cur) => cur || prefill.deliveryNotes!);
    if (prefill.customerNotes)
      setCustomerNotes((cur) => cur || prefill.customerNotes!);
    if (typeof prefill.tip === "number") setTip(prefill.tip);
    if (prefill.method) setMethod(prefill.method);
    if (prefill.paymentMethod) setPaymentMethod(prefill.paymentMethod);
  }, [tenantSlug, setMethod]);

  const deliveryFee = method === "delivery" ? branch?.deliveryFee ?? 0 : 0;
  const serviceFee = branch?.serviceFee ?? 0;
  const couponDiscount = couponApplied?.discount ?? 0;
  const total = subtotal + deliveryFee + serviceFee + tip - couponDiscount;

  /**
   * Re-validate when subtotal changes (line added/removed), since a coupon
   * with min_order or maxDiscount could become invalid or change amount.
   */
  useEffect(() => {
    if (!couponApplied) return;
    void revalidateCoupon(couponApplied.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function revalidateCoupon(code: string) {
    try {
      const res = await fetch("/api/v1/customer/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug, code, subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponApplied({ code, discount: data.discount, message: data.message });
        setCouponError(null);
      } else {
        setCouponApplied(null);
        setCouponError(data.message ?? "הקופון כבר לא תקף");
      }
    } catch {
      setCouponApplied(null);
      setCouponError("בעיה בבדיקת הקוד");
    }
  }

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      await revalidateCoupon(code);
    } finally {
      setCouponBusy(false);
    }
  }

  function clearCoupon() {
    setCouponCode("");
    setCouponApplied(null);
    setCouponError(null);
  }

  // Pre-computed time slots for today, every 15 min starting from now+30min
  // (kitchen prep buffer) up to 23:00. Computed once per mount — a checkout
  // session is short enough that drift doesn't matter, and scheduledIso()
  // below already pushes past-times to tomorrow as a safety net.
  const scheduleSlots = useMemo(() => {
    const out: string[] = [];
    const start = new Date();
    start.setMinutes(start.getMinutes() + 30);
    const overshoot = start.getMinutes() % 15;
    if (overshoot !== 0) start.setMinutes(start.getMinutes() + (15 - overshoot));
    start.setSeconds(0, 0);
    const end = new Date();
    end.setHours(23, 0, 0, 0);
    for (let t = start.getTime(); t <= end.getTime(); t += 15 * 60_000) {
      const d = new Date(t);
      out.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }
    return out;
  }, []);

  /** Convert "HH:mm" to today's ISO datetime so the server gets a real
      timestamp. Returns null if the input is empty/invalid. */
  function scheduledIso(): string | null {
    if (!scheduledTime) return null;
    const [h, m] = scheduledTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    // If the merchant chose a time that's already past, push to tomorrow —
    // the customer probably typo'd; let them confirm before submit.
    if (d.getTime() < Date.now() - 60_000) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString();
  }
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const businessType = (tenant.businessType as BusinessType) ?? "general";

  // While we wait for the route transition to /orders/[id], the cart is
  // already empty — show a friendly processing screen instead of the
  // "הסל ריק" empty state that would flash for the route-change frame.
  if (submitted && !pendingPayment) {
    return <ProcessingScreen />;
  }

  // NOTE: when there's an active pendingPayment, we keep the checkout form
  // visible underneath. Grow's wallet appears as its own overlay on top —
  // replacing the page used to break the SDK's z-index. The SDK component
  // is mounted at the end of the render tree below.

  // Suppress the empty-state during the brief window between the client
  // mounting and the cart finishing localStorage hydration. Otherwise a
  // refresh on /checkout flashes "הסל ריק" before the lines appear (most
  // visible on desktop where the loading.tsx skeleton is taller and the
  // empty-state contrast is sharper).
  if (!hydrated) {
    return <ProcessingScreen />;
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Link
            href={`/${tenantSlug}/menu`}
            className="w-9 h-9 rounded-full bg-white border border-qf-line grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
          <h1 className="font-bold text-lg">סיום הזמנה</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center -mt-12">
          <div className="w-20 h-20 rounded-full bg-qf-green-soft grid place-items-center mb-4">
            <IcoBag c="var(--qf-primary)" s={36} />
          </div>
          <h2 className="font-semibold text-lg mb-1">הסל ריק</h2>
          <p className="text-sm text-qf-mute mb-5">הוסף פריטים מהתפריט וחזור הנה לסיום ההזמנה</p>
          <Link
            href={`/${tenantSlug}/menu`}
            className="px-5 py-3 rounded-full bg-(--qf-primary) text-white font-medium text-sm"
          >
            לתפריט
          </Link>
        </div>
      </div>
    );
  }

  async function place() {
    if (!paymentMethod) {
      setError("בחר אמצעי תשלום");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/customer/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          method,
          payment_method: paymentMethod,
          tip,
          scheduled_for: scheduledIso() ?? undefined,
          coupon_code: couponApplied?.code ?? undefined,
          customer_notes: customerNotes || undefined,
          delivery_notes:
            method === "delivery" && (address || floor || apartment)
              ? [
                  address,
                  apartment ? `דירה ${apartment}` : "",
                  floor ? `קומה ${floor}` : "",
                  deliveryNotes,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined,
          guest_phone: phone || undefined,
          guest_first_name: firstName || undefined,
          guest_last_name: lastName || undefined,
          customer_email: email.trim() || undefined,
          lines: lines.map((l) => ({
            item_id: l.itemId,
            quantity: l.quantity,
            size_id: l.sizeId,
            option_ids: l.options.map((o) => o.optionId),
            notes: l.notes,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(asErrorString(data?.error?.message, "שגיאה ביצירת הזמנה"));
        return;
      }
      const orderId = data.order.id as string;
      // Remember this order so guests can re-order it later from the
      // home screen rail. Logged-in customers see the same rail
      // server-rendered from the DB, but storing the id is harmless.
      recordRecentOrder(tenantSlug, orderId);

      // For non-cash payments we need to render the Grow wallet inline
      // before navigating away. Initiate the payment and stash the
      // authCode — the SDK mount (rendered at the bottom of the form) will
      // overlay the wallet on top of the existing checkout view.
      if (data.needs_payment) {
        try {
          const initRes = await fetch(
            `/api/v1/customer/orders/${orderId}/pay/initiate`,
            { method: "POST", credentials: "include" },
          );
          const initData = await initRes.json();
          if (!initRes.ok || !initData?.sdk_auth_code) {
            setError(
              asErrorString(
                initData?.error?.message,
                "לא הצלחנו לפתוח את שדה התשלום",
              ),
            );
            return;
          }
          // Keep the form intact + cart full so the user can retry if the
          // wallet errors. Cart is cleared by the SDK's onSuccess handler.
          setPendingPayment({
            orderId,
            authCode: initData.sdk_auth_code,
            thankYouUrl: `/${tenantSlug}/orders/${orderId}`,
            // Default to sandbox if the server didn't echo it back (safer
            // than assuming production).
            testMode: initData.test_mode !== false,
          });
          return;
        } catch {
          setError("שגיאה ביצירת תשלום");
          return;
        }
      }

      // Cash flow: skip straight to tracking.
      setSubmitted(true);
      clear();
      router.push(`/${tenantSlug}/orders/${orderId}`);
      // Don't fall through to `setBusy(false)` in finally — the route
      // change tears the component down anyway, and letting `busy` flip
      // back briefly would re-enable the CTA for one frame.
      return;
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Treat any in-flight payment (SDK wallet open or about to open) as
  // "busy" so the CTA can't fire a second order while the user is still
  // settling the first.
  const paymentInFlight = !!pendingPayment;
  const canPlace =
    !busy &&
    !paymentInFlight &&
    !!paymentMethod &&
    !!firstName &&
    !!phone &&
    (method !== "delivery" || !!address) &&
    (!requireEmail || emailLooksValid);

  return (
    <div className="pb-32 bg-qf-bg/40 min-h-screen lg:bg-transparent lg:pb-12">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line sticky top-0 z-10 lg:static lg:bg-transparent lg:border-0 lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-6 lg:pb-2">
        <Link
          href={`/${tenantSlug}/cart`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center lg:hidden"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg lg:text-3xl">סיום הזמנה</h1>
      </header>

      <div className="px-4 mt-4 space-y-3 lg:max-w-6xl lg:mx-auto lg:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0 lg:mt-4"><div className="lg:col-start-1 space-y-3">
        {/* 1. Contact — promoted to the top */}
        <Card>
          <CardTitle>פרטי קשר</CardTitle>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="שם פרטי" required>
              <Input
                value={firstName}
                onChange={setFirstName}
                placeholder="ישראל"
                autoComplete="given-name"
              />
            </Field>
            <Field label="שם משפחה">
              <Input
                value={lastName}
                onChange={setLastName}
                placeholder="ישראלי"
                autoComplete="family-name"
              />
            </Field>
            <div className="col-span-2">
              <Field label="טלפון" required>
                <Input
                  value={phone}
                  onChange={setPhone}
                  placeholder="050-1234567"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
            </div>
            {requireEmail && (
              <div className="col-span-2">
                <Field label="דוא״ל" required>
                  <Input
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    dir="ltr"
                    inputMode="email"
                    autoComplete="email"
                  />
                </Field>
                <div className="text-xs text-qf-mute mt-1">
                  נשלח אליך מייל קצר לאחר ההזמנה כדי שתוכל לדרג אותה
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 2. Delivery / pickup */}
        {method === "delivery" ? (
          <Card>
            <CardTitle>כתובת משלוח</CardTitle>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2">
                <Field label="כתובת" required>
                  <Input
                    value={address}
                    onChange={setAddress}
                    placeholder="רחוב, מספר, עיר"
                    autoComplete="street-address"
                  />
                </Field>
              </div>
              <Field label="דירה">
                <Input value={apartment} onChange={setApartment} placeholder="12" />
              </Field>
              <Field label="קומה">
                <Input value={floor} onChange={setFloor} placeholder="3" />
              </Field>
              <div className="col-span-2">
                <Field label="הוראות לשליח">
                  <Input
                    value={deliveryNotes}
                    onChange={setDeliveryNotes}
                    placeholder="השאר ליד הדלת, להתקשר בהגעה"
                  />
                </Field>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <CardTitle>פרטי איסוף</CardTitle>
            <p className="text-sm text-qf-ink2 mt-2">
              ההזמנה תהיה מוכנה לאיסוף מהסניף ברגע שתאושר על ידי המסעדה.
            </p>
          </Card>
        )}

        {/* 3. Order summary — inline on mobile (between Delivery and Payment).
            On desktop this is rendered again in the right sidebar so it stays
            visible while scrolling through the form. */}
        <div className="lg:hidden">
          <Card>
          <div className="flex items-baseline justify-between">
            <CardTitle>סיכום הזמנה</CardTitle>
            <Link
              href={`/${tenantSlug}/cart`}
              className="text-xs text-(--qf-deep) font-medium hover:underline"
            >
              עריכת סל
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-qf-line-soft">
            {lines.map((l) => {
              const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
              const unit = l.basePrice + l.sizeDelta + opts;
              const lineTotal = unit * l.quantity;
              const variant = [l.sizeName, ...l.options.map((o) => o.name)]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={l.lineId} className="py-2.5 flex gap-3 items-start">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                    <MenuItemImage
                      src={l.imageUrl ?? undefined}
                      alt={l.name}
                      businessType={businessType}
                      size={56}
                      rounded="xl"
                      fill
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm leading-tight">{l.name}</div>
                      <div className="text-sm tnum font-medium shrink-0">
                        {formatPrice(lineTotal)}
                      </div>
                    </div>
                    {variant && (
                      <div className="text-xs text-qf-mute mt-0.5 line-clamp-1">{variant}</div>
                    )}
                    <div className="text-xs text-qf-ink2 mt-1 tnum">× {l.quantity}</div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-1.5 text-sm">
            <SumRow label={`${itemCount} פריטים`} value={formatPrice(subtotal)} />
            {method === "delivery" && (
              <SumRow label="דמי משלוח" value={formatPrice(deliveryFee)} />
            )}
            {serviceFee > 0 && <SumRow label="דמי שירות" value={formatPrice(serviceFee)} />}
            {tip > 0 && <SumRow label="טיפ לשליח" value={formatPrice(tip)} />}
            {couponApplied && (
              <SumRow
                label={`קופון ${couponApplied.code}`}
                value={`−${formatPrice(couponApplied.discount)}`}
                tone="discount"
              />
            )}
            <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
              <div className="font-semibold">סה״כ לתשלום</div>
              <div className="font-bold tnum text-lg">{formatPrice(total)}</div>
            </div>
          </div>
          </Card>
        </div>

        {/* 4. Payment — collapsed to two top-level choices. All online methods
              (card / Bit / Apple Pay / Google Pay) are picked inside Grow's
              wallet when it opens, so showing them all here is noise. */}
        <Card>
          <CardTitle>אמצעי תשלום</CardTitle>
          {availableMethods.length === 0 ? (
            <div className="text-xs text-qf-mute bg-qf-line-soft border border-qf-line-dash rounded-lg px-3 py-2 mt-3">
              המסעדה עוד לא הגדירה אמצעי תשלום. צור איתם קשר ישירות.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {availableMethods.includes("cash") && (
                  <Pill
                    active={paymentMethod === "cash"}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    {PAYMENT_METHOD_LABELS.cash}
                  </Pill>
                )}
                {availableMethods.some((m) => m !== "cash") && (
                  <Pill
                    active={!!paymentMethod && paymentMethod !== "cash"}
                    onClick={() => {
                      // Always advertise as `card`; Grow's wallet shows
                      // whatever payment options the merchant has enabled
                      // (card form, Bit, Apple Pay, Google Pay) once it opens.
                      setPaymentMethod("card");
                    }}
                  >
                    תשלום אונליין
                  </Pill>
                )}
              </div>
              {paymentMethod && paymentMethod !== "cash" && (
                <div className="mt-2 text-xs text-qf-mute">
                  ניתן לשלם בכרטיס אשראי, Bit, Apple Pay ו-Google Pay.
                </div>
              )}
            </>
          )}
        </Card>

        {/* 5. Tip (delivery only — pickup has no courier) */}
        {method === "delivery" && (
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle>טיפ לשליח</CardTitle>
              <span className="text-xs text-qf-mute">אופציונלי</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[0, 5, 10, 15].map((t) => (
                <Pill key={t} active={tip === t} onClick={() => setTip(t)}>
                  {t === 0 ? "ללא" : `+${formatPrice(t)}`}
                </Pill>
              ))}
            </div>
          </Card>
        )}

        {/* 5b. Schedule order. Hidden entirely when the merchant disabled
            scheduled orders in dashboard settings — keeps fast-food queues
            sane. */}
        {tenant.scheduledOrdersEnabled !== false && (
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle>זמן {method === "delivery" ? "משלוח" : "איסוף"}</CardTitle>
              <span className="text-xs text-qf-mute">אופציונלי</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Pill
                active={!showSlots && !scheduledTime}
                onClick={() => {
                  setScheduledTime("");
                  setShowSlots(false);
                }}
              >
                בהקדם האפשרי
              </Pill>
              <Pill
                active={showSlots || !!scheduledTime}
                onClick={() => setShowSlots(true)}
              >
                {scheduledTime ? `תזמן · ${scheduledTime}` : "תזמן לשעה"}
              </Pill>
            </div>
            {showSlots && (
              <div className="mt-3">
                {scheduleSlots.length > 0 ? (
                  <>
                    <p className="text-xs text-qf-mute mb-2">
                      בחר שעת {method === "delivery" ? "מסירה" : "איסוף"} להיום
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                      {scheduleSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setScheduledTime(slot)}
                          className={cn(
                            "shrink-0 snap-start px-4 h-11 rounded-xl text-sm font-semibold border transition tnum active:scale-[0.98]",
                            scheduledTime === slot
                              ? "bg-(--qf-primary) text-white border-transparent shadow-sm shadow-(--qf-primary)/25"
                              : "bg-white text-qf-ink2 border-qf-line hover:border-(--qf-primary)/40",
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-qf-mute mt-2">
                    לא נותרו שעות פנויות להיום — בחר &quot;בהקדם האפשרי&quot;.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 5c. Coupon code */}
        <Card>
          <div className="flex items-baseline justify-between">
            <CardTitle>קוד הנחה</CardTitle>
            {couponApplied && (
              <button
                type="button"
                onClick={clearCoupon}
                className="text-xs text-qf-mute hover:text-qf-tomato"
              >
                הסר קופון
              </button>
            )}
          </div>
          {couponApplied ? (
            <div className="mt-3 bg-qf-green-soft border border-qf-green-deep/20 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-semibold text-qf-green-deep tnum">
                  {couponApplied.code}
                </span>
                <span className="text-xs text-qf-ink2">{couponApplied.message}</span>
              </div>
              <span className="font-bold tnum text-qf-green-deep">
                −{formatPrice(couponApplied.discount)}
              </span>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyCoupon();
                  }
                }}
                placeholder="הקלד קוד"
                maxLength={40}
                dir="ltr"
                className="flex-1 bg-qf-bg border border-qf-line rounded-2xl px-4 py-3 text-base outline-none focus:border-(--qf-primary) focus:bg-white transition tnum"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={!couponCode.trim() || couponBusy}
                className="px-5 rounded-2xl bg-qf-ink text-white text-sm font-semibold disabled:opacity-50 transition"
              >
                {couponBusy ? "..." : "החל"}
              </button>
            </div>
          )}
          {couponError && (
            <div className="mt-2 text-xs text-qf-tomato">{couponError}</div>
          )}
        </Card>

        {/* 6. Notes */}
        <Card>
          <CardTitle>הערה למסעדה</CardTitle>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            rows={2}
            placeholder="למשל: בלי בצל, חתוך ל-8"
            className="w-full mt-3 bg-qf-bg border border-qf-line rounded-2xl px-4 py-3 text-base outline-none focus:border-(--qf-primary) focus:bg-white resize-none transition"
          />
        </Card>

        {error && (
          <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        </div>{/* end left column */}

        {/* Desktop sidebar — sticky order summary + CTA. Hidden on mobile,
            which keeps the inline summary + fixed-footer CTA instead. */}
        <aside className="hidden lg:block lg:col-start-2 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardTitle>סיכום הזמנה</CardTitle>
            <ul className="mt-3 divide-y divide-qf-line-soft max-h-72 overflow-y-auto">
              {lines.map((l) => {
                const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
                const unit = l.basePrice + l.sizeDelta + opts;
                const lineTotal = unit * l.quantity;
                const variant = [l.sizeName, ...l.options.map((o) => o.name)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={l.lineId} className="py-2.5 flex gap-3 items-start">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                      <MenuItemImage
                        src={l.imageUrl ?? undefined}
                        alt={l.name}
                        businessType={businessType}
                        size={48}
                        rounded="md"
                        fill
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm leading-tight">{l.name}</div>
                        <div className="text-sm tnum font-medium shrink-0">{formatPrice(lineTotal)}</div>
                      </div>
                      {variant && (
                        <div className="text-xs text-qf-mute mt-0.5 line-clamp-1">{variant}</div>
                      )}
                      <div className="text-xs text-qf-ink2 mt-0.5 tnum">× {l.quantity}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-1.5 text-sm">
              <SumRow label={`${itemCount} פריטים`} value={formatPrice(subtotal)} />
              {method === "delivery" && (
                <SumRow label="דמי משלוח" value={formatPrice(deliveryFee)} />
              )}
              {serviceFee > 0 && <SumRow label="דמי שירות" value={formatPrice(serviceFee)} />}
              {tip > 0 && <SumRow label="טיפ לשליח" value={formatPrice(tip)} />}
            {couponApplied && (
              <SumRow
                label={`קופון ${couponApplied.code}`}
                value={`−${formatPrice(couponApplied.discount)}`}
                tone="discount"
              />
            )}
              <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
                <div className="font-semibold">סה״כ לתשלום</div>
                <div className="font-bold tnum text-lg">{formatPrice(total)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={place}
              disabled={!canPlace}
              className="w-full mt-4 bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-14 text-base font-semibold flex items-center justify-between shadow-sm shadow-(--qf-primary)/25 transition"
            >
              <span className="inline-flex items-center gap-2">
                {(busy || paymentInFlight) && (
                  <span className="qf-spinner text-white text-base" aria-hidden />
                )}
                <span>
                  {busy
                    ? "שולח..."
                    : paymentInFlight
                      ? walletOpen
                        ? "ממתין לתשלום..."
                        : "פותח תשלום..."
                      : paymentMethod === "cash"
                        ? "בצע הזמנה"
                        : "לשלם כעת"}
                </span>
                {!busy && !paymentInFlight && <IcoArrowLeft c="#fff" s={16} />}
              </span>
              <span className="tnum text-lg">{formatPrice(total)}</span>
            </button>
          </Card>
        </aside>
      </div>

      {/* Fixed CTA — mobile only (desktop uses the sidebar above). */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={place}
          disabled={!canPlace}
          className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-16 text-base font-semibold flex items-center justify-between shadow-lg shadow-(--qf-primary)/25 transition active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2">
            {(busy || paymentInFlight) && (
              <span className="qf-spinner text-white text-base" aria-hidden />
            )}
            <span>
              {busy
                ? "שולח..."
                : paymentInFlight
                  ? walletOpen
                    ? "ממתין לתשלום..."
                    : "פותח תשלום..."
                  : paymentMethod === "cash"
                    ? "בצע הזמנה"
                    : "לשלם כעת"}
            </span>
            {!busy && !paymentInFlight && <IcoArrowLeft c="#fff" s={16} />}
          </span>
          <span className="tnum text-lg">{formatPrice(total)}</span>
        </button>
      </div>

      {/* Grow wallet — pre-loaded on page mount when the tenant has Grow
          enabled, so the SDK has ~1s to do its async setup while the
          customer fills out the form. The wallet itself only renders when
          we trigger `renderGrowWallet(authCode)` after /pay/initiate. */}
      {growEnabled && (
        <GrowPaymentSdk
          testMode={pendingPayment?.testMode ?? growTestMode}
          thankYouUrl={pendingPayment?.thankYouUrl ?? `/${tenantSlug}`}
          onReady={() => setSdkReady(true)}
          onWalletChange={(state) => setWalletOpen(state === "open")}
          onError={(message) => {
            // Only surface the error if we actually have an in-flight
            // payment — pre-mount SDK errors (none of our business) get
            // silently logged via the console hooks in GrowPaymentSdk.
            if (pendingPayment) {
              setError(asErrorString(message, "התשלום נכשל. אפשר לנסות שוב."));
              setPendingPayment(null);
            }
          }}
        />
      )}
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

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-semibold text-base">{children}</h2>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-qf-ink2 mb-1.5">
        {label}
        {required && <span className="text-qf-tomato"> *</span>}
      </div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  dir,
  inputMode,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  dir?: "ltr" | "rtl";
  inputMode?: "tel" | "text" | "email" | "numeric";
  autoComplete?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      inputMode={inputMode}
      autoComplete={autoComplete}
      className="w-full bg-white border border-qf-line rounded-2xl px-4 h-14 text-base outline-none focus:border-(--qf-primary) focus:ring-2 focus:ring-(--qf-primary)/15 placeholder:text-qf-mute transition"
    />
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 h-14 rounded-2xl text-sm transition border font-semibold active:scale-[0.98]",
        active
          ? "bg-(--qf-primary) text-white border-transparent shadow-sm shadow-(--qf-primary)/25"
          : "bg-white text-qf-ink2 border-qf-line hover:border-(--qf-primary)/40",
      )}
    >
      {children}
    </button>
  );
}

function SumRow({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "discount";
}) {
  const valueClass =
    tone === "discount"
      ? "tnum text-qf-green-deep font-semibold"
      : bold
        ? "font-bold tnum text-base"
        : "tnum";
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  );
}

/**
 * Coerce anything that came back from an API/SDK error to a renderable
 * string. We've seen Grow occasionally return `message` as a `{id, message}`
 * object — without this, React error #31 ("object with keys {id, message}")
 * fires the moment we drop it into <div>{error}</div>.
 */
function asErrorString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value) return value;
  if (value == null) return fallback;
  if (typeof value === "object") {
    const obj = value as { message?: unknown };
    if (typeof obj.message === "string" && obj.message) return obj.message;
  }
  return fallback;
}

function ProcessingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 text-center bg-qf-bg/60">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-full bg-white shadow-lg grid place-items-center"
          aria-hidden
        >
          <span className="qf-spinner text-(--qf-primary) text-2xl" />
        </div>
        <div>
          <div className="font-bold text-lg">מעבד את ההזמנה...</div>
          <div className="text-sm text-qf-mute mt-1">רק שניה, מעביר אותך למסך המעקב</div>
        </div>
      </div>
    </div>
  );
}

