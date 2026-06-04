"use client";

import { useEffect, useState } from "react";
import { usePos } from "@/components/pos/PosContext";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { PosCashKeypadModal } from "@/components/pos/PosNumericKeypad";
import { renderGrowWallet } from "@/components/customer/GrowPaymentSdk";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  amount: number;
  /** True for manual-amount sales (the "מספרים" button). False for ticket
   *  sales — the regular cart is dumped to the server as line items. */
  isManual: boolean;
  /** When set, this sheet settles an existing order (kiosk queue case).
   *  When NULL, it creates a fresh POS order before charging. */
  existingOrderId?: string;
  onClose: () => void;
  onPaid: () => void;
}

type Method = "cash" | "card";

export function PosPaymentSheet({ amount, isManual, existingOrderId, onClose, onPaid }: Props) {
  const { shift } = usePos();
  const { lines, customer, notes } = usePosCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  // The Grow wallet is mounted at the shell level. We listen for the
  // shell-emitted "wallet closed" event so the sheet can clear itself
  // once the wallet UI goes away — payment status update comes from the
  // Grow S2S callback, not from the front-end close event.
  useEffect(() => {
    function onWalletClose() {
      if (cardOpen) {
        setCardOpen(false);
        onPaid();
      }
    }
    window.addEventListener("qf:pos:wallet-close", onWalletClose);
    return () => window.removeEventListener("qf:pos:wallet-close", onWalletClose);
  }, [cardOpen, onPaid]);

  async function createOrCarryOrderId(paymentMethod: Method): Promise<string | null> {
    if (existingOrderId) return existingOrderId;
    setBusy(true);
    try {
      const endpoint = isManual
        ? "/api/v1/merchant/pos/manual-sale"
        : "/api/v1/merchant/pos/sale";
      const body = isManual
        ? {
            amount,
            shift_id: shift?.id,
            customer_id: customer?.id ?? null,
            notes: notes || undefined,
            payment_method: paymentMethod,
          }
        : {
            shift_id: shift?.id,
            customer_id: customer?.id ?? null,
            notes: notes || undefined,
            payment_method: paymentMethod,
            lines: lines.map((l) => ({
              item_id: l.itemId,
              quantity: l.quantity,
              size_id: l.sizeId,
              option_ids: l.options.map((o) => o.optionId),
              option_placements: Object.fromEntries(
                l.options.filter((o) => o.half).map((o) => [o.optionId, o.half!]),
              ),
              notes: l.notes ?? undefined,
            })),
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "יצירת ההזמנה נכשלה");
        return null;
      }
      return data.order.id as string;
    } finally {
      setBusy(false);
    }
  }

  async function chooseCash() {
    setError(null);
    setMethod("cash");
  }

  async function chooseCard() {
    setError(null);
    setMethod("card");
    const orderId = await createOrCarryOrderId("card");
    if (!orderId) {
      setMethod(null);
      return;
    }
    setBusy(true);
    try {
      // For queue orders the existing record was created as cash by the
      // kiosk; flip it to card before initiating so pay/initiate doesn't
      // reject. Fresh POS-created orders already get the right method.
      if (existingOrderId) {
        await fetch(`/api/v1/merchant/orders/${orderId}/payment-method`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ payment_method: "card" }),
        });
      }
      const res = await fetch(`/api/v1/customer/orders/${orderId}/pay/initiate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "פתיחת תשלום אשראי נכשלה");
        return;
      }
      setCardOpen(true);
      // Render Grow wallet — same component the customer storefront uses.
      renderGrowWallet(data.sdk_auth_code);
      // Card success is detected via the customer-orders polling loop;
      // simplest in v1: after the wallet closes, the cashier confirms.
    } finally {
      setBusy(false);
    }
  }

  async function confirmCash(received: number, change: number) {
    setError(null);
    const orderId = await createOrCarryOrderId("cash");
    if (!orderId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/orders/${orderId}/cash-collected`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: received, change, shift_id: shift?.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "שמירת המזומן נכשלה");
        return;
      }
      onPaid();
    } finally {
      setBusy(false);
    }
  }

  if (method === "cash") {
    return (
      <PosCashKeypadModal
        total={amount}
        onCancel={() => setMethod(null)}
        onConfirm={confirmCash}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-6 animate-qf-check-in"
      >
        <h2 className="text-xl font-black text-center">בחר אמצעי תשלום</h2>
        <div className="text-center text-3xl font-black tnum my-4">
          {formatPrice(amount)}
        </div>

        {error && (
          <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={chooseCash}
            disabled={busy}
            className={cn(
              "h-24 rounded-2xl bg-[#F8CB1E] border-2 border-black font-black text-lg shadow-[0_3px_0_#000] disabled:opacity-50",
            )}
          >
            מזומן
          </button>
          <button
            type="button"
            onClick={chooseCard}
            disabled={busy}
            className={cn(
              "h-24 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-black text-lg shadow-[0_3px_0_#000] disabled:opacity-50",
            )}
          >
            אשראי
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 rounded-xl text-sm text-qf-mute hover:bg-qf-line-soft"
        >
          חזרה
        </button>

        {cardOpen && (
          <p className="mt-3 text-xs text-qf-mute text-center">
            ארנק התשלום של Grow נפתח. סיים את התשלום שם.
          </p>
        )}
      </div>
    </div>
  );
}
