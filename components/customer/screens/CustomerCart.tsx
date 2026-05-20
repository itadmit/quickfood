"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IcoChev, IcoPlus, IcoMinus, IcoBag } from "@/components/shared/Icons";
import { PizzaArt } from "@/components/customer/PizzaArt";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";

export function CustomerCart({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const { lines, updateQuantity, remove, subtotal, method, branch, tenant } = useCart();

  const deliveryFee = method === "delivery" ? branch?.deliveryFee ?? 0 : 0;
  const serviceFee = branch?.serviceFee ?? 0;
  const total = subtotal + deliveryFee + serviceFee;
  const minOrder = branch?.minOrder ?? 0;
  const meetsMin = subtotal >= minOrder;

  if (lines.length === 0) {
    return (
      <div className="min-h-screen flex flex-col pb-24">
        <header className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Link
            href={`/${tenantSlug}/menu`}
            className="w-9 h-9 rounded-full bg-white border border-qf-line grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
          <h1 className="font-bold text-lg">הסל שלי</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
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
        <BottomTabBar tenantSlug={tenantSlug} />
      </div>
    );
  }

  return (
    <div className="pb-44">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line sticky top-0 z-10">
        <Link
          href={`/${tenantSlug}/menu`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg">הסל שלי</h1>
        <span className="text-xs text-qf-mute">· {tenant.name}</span>
      </header>

      {/* Lines */}
      <div className="px-5 mt-3 space-y-2.5">
        {lines.map((l) => {
          const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
          const unit = l.basePrice + l.sizeDelta + opts;
          const lineTotal = unit * l.quantity;
          const variant = [l.sizeName, ...l.options.map((o) => o.name)].filter(Boolean).join(" · ");
          return (
            <div
              key={l.lineId}
              className="bg-white rounded-2xl border border-qf-line p-3 flex gap-3"
            >
              <div className="w-16 h-16 rounded-xl bg-qf-warm grid place-items-center shrink-0">
                <PizzaArt size={60} type={l.artType ?? "margherita"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium leading-tight">{l.name}</div>
                  <button
                    type="button"
                    onClick={() => remove(l.lineId)}
                    className="text-qf-mute hover:text-qf-tomato text-lg leading-none"
                    aria-label="הסר"
                  >
                    ×
                  </button>
                </div>
                {variant && (
                  <div className="text-xs text-qf-mute mt-0.5 line-clamp-1">{variant}</div>
                )}
                {l.notes && (
                  <div className="text-xs text-qf-ink2 mt-0.5">הערה: {l.notes}</div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center bg-qf-bg rounded-full border border-qf-line">
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.lineId, l.quantity - 1)}
                      className="w-7 h-7 grid place-items-center"
                      aria-label="הפחת"
                    >
                      <IcoMinus s={14} />
                    </button>
                    <div className="w-6 text-center text-sm font-semibold tnum">{l.quantity}</div>
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.lineId, l.quantity + 1)}
                      className="w-7 h-7 grid place-items-center"
                      aria-label="הוסף"
                    >
                      <IcoPlus c="#11231a" s={14} />
                    </button>
                  </div>
                  <div className="font-semibold tnum">{formatPrice(lineTotal)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <section className="px-5 mt-5 space-y-2 text-sm">
        <Row label="סכום ביניים" value={formatPrice(subtotal)} />
        {method === "delivery" && <Row label="דמי משלוח" value={formatPrice(deliveryFee)} />}
        {serviceFee > 0 && <Row label="דמי שירות" value={formatPrice(serviceFee)} />}
        <Row bold label="סה״כ" value={formatPrice(total)} />
      </section>

      {/* Footer CTA */}
      <div className="fixed bottom-20 inset-x-0 z-30 max-w-md mx-auto px-4">
        {!meetsMin && (
          <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2 mb-2">
            חסר {formatPrice(minOrder - subtotal)} לסכום מינימום ({formatPrice(minOrder)})
          </div>
        )}
        <button
          type="button"
          disabled={!meetsMin}
          onClick={() => router.push(`/${tenantSlug}/checkout`)}
          className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute text-white rounded-2xl px-4 py-3.5 font-semibold flex items-center justify-between"
        >
          <span>המשך לתשלום</span>
          <span className="tnum">{formatPrice(total)}</span>
        </button>
      </div>

      <BottomTabBar tenantSlug={tenantSlug} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={bold ? "font-bold tnum text-base" : "tnum"}>{value}</div>
    </div>
  );
}
