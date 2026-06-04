"use client";

import { useState } from "react";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { formatPrice } from "@/lib/format";
import { IcoUser, IcoPlus, IcoMinus, IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { PosNumericKeypadModal } from "@/components/pos/PosNumericKeypad";
import { PosPaymentSheet } from "@/components/pos/PosPaymentSheet";

export function PosTicket() {
  const { lines, subtotal, updateQuantity, remove, customer, setCustomer, clear } =
    usePosCart();
  const [manualOpen, setManualOpen] = useState(false);
  const [payment, setPayment] = useState<{ amount: number; isManual: boolean } | null>(null);

  const hasContent = lines.length > 0;

  function openCashPay() {
    if (!hasContent) return;
    setPayment({ amount: subtotal, isManual: false });
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

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasContent ? (
          lines.map((l) => (
            <article
              key={l.lineId}
              className="rounded-xl border border-qf-line bg-white px-3 py-2 flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{l.name}</div>
                {l.sizeName && (
                  <div className="text-[11px] text-qf-mute">{l.sizeName}</div>
                )}
              </div>
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
                {formatPrice((l.basePrice + l.sizeDelta) * l.quantity)}
              </div>
              <button
                type="button"
                onClick={() => remove(l.lineId)}
                className="w-7 h-7 rounded-md grid place-items-center text-qf-mute hover:bg-qf-tomato-soft hover:text-qf-tomato"
                aria-label="מחק"
              >
                <IcoClose s={12} />
              </button>
            </article>
          ))
        ) : (
          <div className="h-full grid place-items-center text-qf-mute text-sm py-12">
            כרטיסייה ריקה — בחרו פריט מהתפריט או הקליקו &quot;מספרים&quot;.
          </div>
        )}
      </div>

      <footer className="border-t-2 border-black p-3 space-y-2 bg-qf-bg/40">
        <div className="flex items-center justify-between text-base font-bold">
          <span>סה״כ</span>
          <span className="tnum">{formatPrice(subtotal)}</span>
        </div>
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
            onClick={openCashPay}
            disabled={!hasContent}
            className="px-3 py-3 rounded-xl bg-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] disabled:opacity-40"
          >
            מזומן
          </button>
          <button
            type="button"
            onClick={openCashPay}
            disabled={!hasContent}
            className="px-3 py-3 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] disabled:opacity-40"
          >
            אשראי
          </button>
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={() => {
              if (confirm("לבטל את הכרטיסייה?")) clear();
            }}
            className="w-full text-xs text-qf-tomato hover:underline"
          >
            ביטול כרטיסייה
          </button>
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

      {payment && (
        <PosPaymentSheet
          amount={payment.amount}
          isManual={payment.isManual}
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
