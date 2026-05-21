"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev, IcoArrowLeft } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { recordRecentOrder } from "@/lib/recent-orders-storage";

type CustomerPaymentMethod = "cash" | "card" | "bit" | "apple_pay" | "google_pay";

const PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  cash: "מזומן בעת המסירה",
  card: "כרטיס אשראי",
  bit: "Bit",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export function CustomerCheckout({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const { lines, method, subtotal, branch, tenant, clear } = useCart();

  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [availableMethods, setAvailableMethods] = useState<CustomerPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the POST /orders call has succeeded — even though we clear()
  // the cart immediately afterward, this stays true until the browser
  // finishes navigating to /orders/[id], so we can show a "processing"
  // screen instead of the "הסל ריק" empty-state flashing for ~250ms.
  const [submitted, setSubmitted] = useState(false);

  // Load the restaurant's accepted payment methods.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/restaurants/${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((d: { restaurant?: { payment_methods?: CustomerPaymentMethod[] } }) => {
        if (cancelled) return;
        const methods = d.restaurant?.payment_methods ?? [];
        setAvailableMethods(methods);
        const preferred: CustomerPaymentMethod[] = ["cash", "card", "bit", "apple_pay", "google_pay"];
        const first = preferred.find((m) => methods.includes(m)) ?? null;
        setPaymentMethod(first);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const deliveryFee = method === "delivery" ? branch?.deliveryFee ?? 0 : 0;
  const serviceFee = branch?.serviceFee ?? 0;
  const total = subtotal + deliveryFee + serviceFee + tip;
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const businessType = (tenant.businessType as BusinessType) ?? "general";

  // While we wait for the route transition to /orders/[id], the cart is
  // already empty — show a friendly processing screen instead of the
  // "הסל ריק" empty state that would flash for the route-change frame.
  if (submitted) {
    return <ProcessingScreen />;
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-qf-mute mb-4">הסל ריק</p>
          <Link href={`/${tenantSlug}/menu`} className="text-(--qf-deep) underline">
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
          customer_notes: customerNotes || undefined,
          delivery_notes:
            method === "delivery" && (address || floor)
              ? `${address} ${floor ? `· קומה ${floor}` : ""}${deliveryNotes ? ` · ${deliveryNotes}` : ""}`.trim()
              : undefined,
          guest_phone: phone || undefined,
          guest_first_name: firstName || undefined,
          guest_last_name: lastName || undefined,
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
        setError(data?.error?.message ?? "שגיאה ביצירת הזמנה");
        return;
      }
      const orderId = data.order.id as string;
      // Remember this order so guests can re-order it later from the
      // home screen rail. Logged-in customers see the same rail
      // server-rendered from the DB, but storing the id is harmless.
      recordRecentOrder(tenantSlug, orderId);
      // Flip to "submitted" BEFORE clearing the cart so the next render
      // shows the processing screen instead of the "הסל ריק" early
      // return. Then clear() + navigate.
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

  const canPlace =
    !busy &&
    !!paymentMethod &&
    !!firstName &&
    !!phone &&
    (method !== "delivery" || !!address);

  return (
    <div className="pb-32 bg-qf-bg/40 min-h-screen">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line sticky top-0 z-10">
        <Link
          href={`/${tenantSlug}/cart`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg">סיום הזמנה</h1>
      </header>

      <div className="px-4 mt-4 space-y-3">
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
          </div>
        </Card>

        {/* 2. Delivery / pickup */}
        {method === "delivery" ? (
          <Card>
            <CardTitle>כתובת משלוח</CardTitle>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <Field label="כתובת" required>
                <Input
                  value={address}
                  onChange={setAddress}
                  placeholder="רחוב, מספר, עיר"
                  autoComplete="street-address"
                />
              </Field>
              <Field label="קומה / דירה">
                <Input value={floor} onChange={setFloor} placeholder="לדוגמה: 3 · דירה 12" />
              </Field>
              <Field label="הוראות לשליח">
                <Input
                  value={deliveryNotes}
                  onChange={setDeliveryNotes}
                  placeholder="השאר ליד הדלת, להתקשר בהגעה"
                />
              </Field>
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

        {/* 3. Order summary — with thumbnails */}
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
            <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
              <div className="font-semibold">סה״כ לתשלום</div>
              <div className="font-bold tnum text-lg">{formatPrice(total)}</div>
            </div>
          </div>
        </Card>

        {/* 4. Payment */}
        <Card>
          <CardTitle>אמצעי תשלום</CardTitle>
          {availableMethods.length === 0 ? (
            <div className="text-xs text-qf-mute bg-qf-line-soft border border-qf-line-dash rounded-lg px-3 py-2 mt-3">
              המסעדה עוד לא הגדירה אמצעי תשלום. צור איתם קשר ישירות.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {availableMethods.map((m) => (
                  <Pill
                    key={m}
                    active={paymentMethod === m}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </Pill>
                ))}
              </div>
              {paymentMethod && paymentMethod !== "cash" && (
                <div className="mt-2 text-xs text-qf-mute bg-qf-yolk-soft border border-qf-yolk/40 rounded-lg px-3 py-2">
                  החיוב יתבצע מיד אחרי אישור ההזמנה דרך Grow.
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
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={place}
          disabled={!canPlace}
          className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-16 text-base font-semibold flex items-center justify-between shadow-lg shadow-(--qf-primary)/25 transition active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2">
            <span>{busy ? "שולח..." : "בצע הזמנה"}</span>
            {!busy && <IcoArrowLeft c="#fff" s={16} />}
          </span>
          <span className="tnum text-lg">{formatPrice(total)}</span>
        </button>
      </div>
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
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={bold ? "font-bold tnum text-base" : "tnum"}>{value}</div>
    </div>
  );
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
