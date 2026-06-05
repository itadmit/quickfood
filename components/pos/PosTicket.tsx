"use client";

import { useState } from "react";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { formatPrice } from "@/lib/format";
import { IcoUser, IcoPlus, IcoMinus, IcoClose, IcoEdit } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { PosNumericKeypadModal } from "@/components/pos/PosNumericKeypad";
import { PosPaymentSheet } from "@/components/pos/PosPaymentSheet";
import { PosDiscountModal } from "@/components/pos/PosDiscountModal";
import { PosTipModal } from "@/components/pos/PosTipModal";
import { PosParkLabelModal } from "@/components/pos/PosParkLabelModal";
import type { CartLine } from "@/components/customer/CartProvider";

export function PosTicket({ onEditLine }: { onEditLine?: (line: CartLine) => void }) {
  const {
    lines,
    subtotal,
    updateQuantity,
    remove,
    customer,
    setCustomer,
    clear,
    discount,
    setDiscount,
    discountAmount,
    tip,
    setTip,
    tipAmount,
    total,
    park,
  } = usePosCart();
  const [manualOpen, setManualOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [parkOpen, setParkOpen] = useState(false);
  const [payment, setPayment] = useState<{
    amount: number;
    isManual: boolean;
    initialMethod?: "cash" | "card";
    manualDiscount?: number;
    tip?: number;
  } | null>(null);

  const hasContent = lines.length > 0;

  function openPayment(method: "cash" | "card") {
    if (!hasContent) return;
    setPayment({
      amount: total,
      isManual: false,
      initialMethod: method,
      manualDiscount: discountAmount > 0 ? discountAmount : undefined,
      tip: tipAmount > 0 ? tipAmount : undefined,
    });
  }

  function openManualSale() {
    setManualOpen(true);
  }

  return (
    <>
      <header className="border-b-2 border-black px-4 py-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-qf-mute">לקוח</div>
          <div className="font-bold truncate text-sm">{customer?.name ?? "אורח"}</div>
        </div>
        <button
          type="button"
          onClick={() => setCustomer(null)}
          className={cn(
            "px-3 py-2 rounded-xl border-2 border-black text-sm font-bold shadow-[0_2px_0_#000] inline-flex items-center gap-1.5",
            customer ? "bg-white" : "bg-[#F8CB1E]",
          )}
        >
          <IcoUser s={14} c="#000" />
          <span>{customer ? "החלף" : "צרף"}</span>
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
        {hasContent ? (
          lines.map((l) => {
            const optionsDelta = l.options.reduce(
              (s, o) => s + (o.half && o.half !== "full" ? o.priceDelta / 2 : o.priceDelta),
              0,
            );
            const lineTotal = (l.basePrice + l.sizeDelta + optionsDelta) * l.quantity;
            const optsSummary = l.options
              .map((o) => {
                const sideTag =
                  o.half === "left" ? " (חצי א׳)" : o.half === "right" ? " (חצי ב׳)" : "";
                return `${o.name}${sideTag}`;
              })
              .join(" · ");
            return (
              <article
                key={l.lineId}
                className="rounded-xl border border-qf-line bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{l.name}</div>
                    {l.sizeName && (
                      <div className="text-[11px] text-qf-mute">{l.sizeName}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditLine?.(l)}
                    className="w-8 h-8 rounded-lg bg-qf-line-soft hover:bg-(--qf-soft) hover:text-(--qf-deep) grid place-items-center transition"
                    aria-label="ערוך שורה"
                    title="ערוך תוספות / גודל"
                  >
                    <IcoEdit s={14} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.lineId, l.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-qf-line-soft grid place-items-center"
                      aria-label="הפחת"
                    >
                      <IcoMinus s={14} c="#11231a" />
                    </button>
                    <span className="w-6 text-center tnum text-sm font-bold">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.lineId, l.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-qf-line-soft grid place-items-center"
                      aria-label="הוסף"
                    >
                      <IcoPlus s={14} c="#11231a" />
                    </button>
                  </div>
                  <div className="w-20 text-end tnum text-sm font-semibold">
                    {formatPrice(lineTotal)}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(l.lineId)}
                    className="w-7 h-7 rounded-md grid place-items-center text-qf-mute hover:bg-qf-tomato-soft hover:text-qf-tomato"
                    aria-label="מחק"
                  >
                    <IcoClose s={12} />
                  </button>
                </div>
                {optsSummary && (
                  <button
                    type="button"
                    onClick={() => onEditLine?.(l)}
                    className="block text-start mt-1 text-[11px] text-qf-ink2 truncate w-full hover:underline"
                  >
                    {optsSummary}
                  </button>
                )}
                {l.notes && (
                  <div className="mt-1 text-[11px] text-qf-mute italic truncate">
                    הערה: {l.notes}
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="h-full grid place-items-center text-qf-mute text-sm py-12">
            כרטיסייה ריקה - בחרו פריט מהתפריט או הקליקו &quot;מספרים&quot;.
          </div>
        )}
      </div>

      <footer className="border-t-2 border-black p-3 space-y-2 bg-qf-bg/40">
        {(discountAmount > 0 || tipAmount > 0) && (
          <div className="flex items-center justify-between text-sm text-qf-mute">
            <span>סכום ביניים</span>
            <span className="tnum">{formatPrice(subtotal)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm text-qf-green-deep font-bold">
            <button
              type="button"
              onClick={() => setDiscountOpen(true)}
              className="underline"
            >
              הנחה
              {discount?.mode === "percent" ? ` (${discount.value}%)` : ""}
            </button>
            <span className="tnum">−{formatPrice(discountAmount)}</span>
          </div>
        )}
        {tipAmount > 0 && (
          <div className="flex items-center justify-between text-sm text-(--qf-deep) font-bold">
            <button
              type="button"
              onClick={() => setTipOpen(true)}
              className="underline"
            >
              טיפ
              {tip?.mode === "percent" ? ` (${tip.value}%)` : ""}
            </button>
            <span className="tnum">+{formatPrice(tipAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-base font-bold">
          <span>סה״כ</span>
          <span className="tnum">{formatPrice(total)}</span>
        </div>
        {hasContent && (discountAmount === 0 || tipAmount === 0) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            {discountAmount === 0 && (
              <button
                type="button"
                onClick={() => setDiscountOpen(true)}
                className="text-(--qf-deep) hover:underline text-start"
              >
                + הוסף הנחה
              </button>
            )}
            {tipAmount === 0 && (
              <button
                type="button"
                onClick={() => setTipOpen(true)}
                className="text-(--qf-deep) hover:underline text-end ms-auto"
              >
                + הוסף טיפ
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={openManualSale}
            className="px-3 py-3 rounded-xl bg-white border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          >
            מספרים
          </button>
          <button
            type="button"
            onClick={() => openPayment("cash")}
            disabled={!hasContent}
            className="px-3 py-3 rounded-xl bg-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] disabled:opacity-40"
          >
            מזומן
          </button>
          <button
            type="button"
            onClick={() => openPayment("card")}
            disabled={!hasContent}
            className="px-3 py-3 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] disabled:opacity-40"
          >
            אשראי
          </button>
        </div>
        {hasContent && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={() => setParkOpen(true)}
              className="text-(--qf-deep) hover:underline font-bold"
            >
              החזק כרטיסייה
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("לבטל את הכרטיסייה?")) clear();
              }}
              className="text-qf-tomato hover:underline"
            >
              ביטול כרטיסייה
            </button>
          </div>
        )}
      </footer>

      {manualOpen && (
        <PosNumericKeypadModal
          title="חיוב סכום ידני"
          confirmLabel="חייב סכום זה"
          onCancel={() => setManualOpen(false)}
          onConfirm={(amount) => {
            setManualOpen(false);
            if (amount > 0) setPayment({ amount, isManual: true });
          }}
        />
      )}

      {discountOpen && (
        <PosDiscountModal
          subtotal={subtotal}
          current={discount}
          onCancel={() => setDiscountOpen(false)}
          onConfirm={(d) => {
            setDiscount(d);
            setDiscountOpen(false);
          }}
        />
      )}

      {tipOpen && (
        <PosTipModal
          subtotal={subtotal}
          current={tip}
          onCancel={() => setTipOpen(false)}
          onConfirm={(t) => {
            setTip(t);
            setTipOpen(false);
          }}
        />
      )}

      {parkOpen && (
        <PosParkLabelModal
          onCancel={() => setParkOpen(false)}
          onConfirm={(label) => {
            park(label);
            setParkOpen(false);
          }}
        />
      )}

      {payment && (
        <PosPaymentSheet
          amount={payment.amount}
          isManual={payment.isManual}
          initialMethod={payment.initialMethod}
          manualDiscount={payment.manualDiscount}
          onClose={() => setPayment(null)}
          onPaid={() => {
            setPayment(null);
            clear();
          }}
        />
      )}
    </>
  );
}
