"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev } from "@/components/shared/Icons";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

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
  const { lines, method, subtotal, branch, clear } = useCart();

  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [availableMethods, setAvailableMethods] = useState<CustomerPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the restaurant's accepted payment methods.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/restaurants/${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((d: { restaurant?: { payment_methods?: CustomerPaymentMethod[] } }) => {
        if (cancelled) return;
        const methods = d.restaurant?.payment_methods ?? [];
        setAvailableMethods(methods);
        // Prefer cash ← card ← bit ← apple_pay ← google_pay (first available)
        const preferred: CustomerPaymentMethod[] = ["cash", "card", "bit", "apple_pay", "google_pay"];
        const first = preferred.find((m) => methods.includes(m)) ?? null;
        setPaymentMethod(first);
      })
      .catch(() => {
        /* leave empty; place() will show an error */
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const deliveryFee = method === "delivery" ? branch?.deliveryFee ?? 0 : 0;
  const serviceFee = branch?.serviceFee ?? 0;
  const total = subtotal + deliveryFee + serviceFee + tip;

  if (lines.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-qf-mute mb-4">הסל ריק</p>
          <Link
            href={`/${tenantSlug}/menu`}
            className="text-(--qf-deep) underline"
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
          customer_notes: customerNotes || undefined,
          delivery_notes:
            method === "delivery" && (address || floor)
              ? `${address} ${floor ? `· קומה ${floor}` : ""}${deliveryNotes ? ` · ${deliveryNotes}` : ""}`.trim()
              : undefined,
          guest_phone: phone || undefined,
          guest_name: name || undefined,
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
      clear();
      router.push(`/${tenantSlug}/orders/${orderId}`);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-44">
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

      {/* Method recap */}
      <Section title={method === "delivery" ? "כתובת משלוח" : "פרטי איסוף"}>
        {method === "delivery" && (
          <div className="space-y-2.5">
            <Input value={address} onChange={setAddress} placeholder="רחוב, מספר, עיר" />
            <Input value={floor} onChange={setFloor} placeholder="קומה / דירה" />
            <Input
              value={deliveryNotes}
              onChange={setDeliveryNotes}
              placeholder="הוראות לשליח (למשל: השאר ליד הדלת)"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <Input value={name} onChange={setName} placeholder="שם מלא" />
          <Input value={phone} onChange={setPhone} placeholder="טלפון 050-1234567" dir="ltr" />
        </div>
      </Section>

      {/* Payment method — only the ones the restaurant accepts */}
      <Section title="אמצעי תשלום">
        {availableMethods.length === 0 ? (
          <div className="text-xs text-qf-mute bg-qf-line-soft border border-qf-line-dash rounded-lg px-3 py-2">
            המסעדה עוד לא הגדירה אמצעי תשלום. צור איתם קשר ישירות.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
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
      </Section>

      {/* Tip */}
      <Section title="טיפ לשליח" hint="אופציונלי">
        <div className="flex gap-2 flex-wrap">
          {[0, 5, 10, 15].map((t) => (
            <Pill key={t} active={tip === t} onClick={() => setTip(t)}>
              {t === 0 ? "ללא" : `+${formatPrice(t)}`}
            </Pill>
          ))}
        </div>
      </Section>

      {/* Notes */}
      <Section title="הערה למסעדה">
        <textarea
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          rows={2}
          placeholder="למשל: בלי בצל, חתוך ל-8"
          className="w-full bg-white border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary)"
        />
      </Section>

      {/* Summary */}
      <section className="px-5 mt-5 space-y-1.5 text-sm">
        <SumRow label={`${lines.length} פריטים`} value={formatPrice(subtotal)} />
        {method === "delivery" && (
          <SumRow label="דמי משלוח" value={formatPrice(deliveryFee)} />
        )}
        {serviceFee > 0 && <SumRow label="דמי שירות" value={formatPrice(serviceFee)} />}
        {tip > 0 && <SumRow label="טיפ" value={formatPrice(tip)} />}
        <SumRow bold label="סה״כ לתשלום" value={formatPrice(total)} />
      </section>

      {error && (
        <div className="mx-5 mt-4 bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line p-4">
        <button
          type="button"
          onClick={place}
          disabled={
            busy ||
            !paymentMethod ||
            (method === "delivery" && !address) ||
            !phone ||
            !name
          }
          className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute text-white rounded-2xl px-4 py-3.5 font-semibold flex items-center justify-between"
        >
          <span>{busy ? "שולח..." : "בצע הזמנה"}</span>
          <span className="tnum">{formatPrice(total)}</span>
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 mt-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        {hint && <span className="text-xs text-qf-mute">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="w-full bg-white border border-qf-line rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-(--qf-primary) placeholder:text-qf-mute"
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
        "px-3.5 py-2.5 rounded-xl text-sm transition border",
        active
          ? "bg-(--qf-primary) text-white border-transparent"
          : "bg-white text-qf-ink2 border-qf-line",
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
