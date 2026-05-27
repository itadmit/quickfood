"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IcoBag, IcoPlus, IcoMinus, IcoClose, IcoArrowLeft } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";

interface Props {
  tenantSlug: string;
  businessType: BusinessType;
}

/**
 * Sticky cart sidebar shown next to the menu on desktop (lg+). On mobile the
 * floating "Show cart" pill is used instead. Mirrors the Cart screen but
 * always-visible inside the menu, so customers can build their order without
 * navigating away.
 */
export function MenuCartSidebar({ tenantSlug, businessType }: Props) {
  const router = useRouter();
  const { lines, updateQuantity, remove, subtotal, branch, method, itemCount } = useCart();

  const deliveryFee = method === "delivery" ? branch?.deliveryFee ?? 0 : 0;
  const serviceFee = branch?.serviceFee ?? 0;
  const total = subtotal + deliveryFee + serviceFee;
  const minOrder = branch?.minOrder ?? 0;
  const meetsMin = subtotal >= minOrder;

  return (
    <aside className="hidden lg:flex sticky top-20 self-start flex-col bg-white border border-qf-line rounded-2xl shadow-sm overflow-hidden max-h-[calc(100vh-6rem)]">
      <div className="px-4 py-3 border-b border-qf-line flex items-center gap-2">
        <IcoBag c="var(--qf-primary)" s={18} />
        <h2 className="font-semibold">ההזמנה שלי</h2>
        {itemCount > 0 && (
          <span className="ms-auto text-xs text-qf-mute tnum">{itemCount} פריטים</span>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="p-8 text-center text-sm text-qf-mute flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-qf-green-soft grid place-items-center">
            <IcoBag c="var(--qf-primary)" s={24} />
          </div>
          <div>
            <div className="font-medium text-qf-ink mb-1">הסל ריק</div>
            <div>הוסף פריטים מהתפריט כדי להתחיל</div>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex-1 overflow-y-auto divide-y divide-qf-line-soft px-3">
            {lines.map((l) => {
              const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
              const unit = l.basePrice + l.sizeDelta + opts;
              const lineTotal = unit * l.quantity;
              const variant = [l.sizeName, ...l.options.map((o) => o.name)]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={l.lineId} className="py-3 flex gap-3 items-start">
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
                      <button
                        type="button"
                        onClick={() => remove(l.lineId)}
                        className="w-6 h-6 rounded-full text-qf-mute hover:text-qf-tomato hover:bg-qf-tomato-soft grid place-items-center -m-1 shrink-0 transition"
                        aria-label="הסר"
                      >
                        <IcoClose s={12} c="currentColor" />
                      </button>
                    </div>
                    {variant && (
                      <div className="text-[11px] text-qf-mute mt-0.5 leading-relaxed">{variant}</div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center bg-qf-bg rounded-full border border-qf-line">
                        <button
                          type="button"
                          onClick={() => updateQuantity(l.lineId, l.quantity - 1)}
                          className="w-7 h-7 grid place-items-center transition"
                          aria-label="הפחת"
                        >
                          <IcoMinus s={12} />
                        </button>
                        <div className="w-5 text-center text-xs font-bold tnum">{l.quantity}</div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(l.lineId, l.quantity + 1)}
                          className="w-7 h-7 grid place-items-center transition"
                          aria-label="הוסף"
                        >
                          <IcoPlus c="#11231a" s={12} />
                        </button>
                      </div>
                      <div className="font-semibold tnum text-sm">{formatPrice(lineTotal)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-qf-line px-4 py-3 space-y-1.5 text-sm">
            <Row label="סכום ביניים" value={formatPrice(subtotal)} />
            {method === "delivery" && (
              <Row label="דמי משלוח" value={formatPrice(deliveryFee)} />
            )}
            {serviceFee > 0 && <Row label="דמי שירות" value={formatPrice(serviceFee)} />}
            <div className="border-t border-qf-line-soft pt-2 mt-2 flex items-center justify-between">
              <div className="font-semibold">סה״כ</div>
              <div className="font-bold tnum text-base">{formatPrice(total)}</div>
            </div>
          </div>

          <div className="px-4 pb-4 pt-1">
            {!meetsMin && (
              <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2 mb-2">
                חסר {formatPrice(minOrder - subtotal)} לסכום מינימום
              </div>
            )}
            <Link
              href={`/s/${tenantSlug}/checkout`}
              onClick={(e) => {
                if (!meetsMin) {
                  e.preventDefault();
                  router.push(`/s/${tenantSlug}/cart`);
                }
              }}
              className="block bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-2xl px-4 h-12 text-sm font-semibold transition shadow-sm shadow-(--qf-primary)/25"
            >
              <span className="flex items-center justify-between h-full">
                <span className="inline-flex items-center gap-2">
                  <span>המשך להזמנה</span>
                  <IcoArrowLeft c="#fff" s={14} />
                </span>
                <span className="tnum">{formatPrice(total)}</span>
              </span>
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-qf-ink2">{label}</div>
      <div className="tnum">{value}</div>
    </div>
  );
}
