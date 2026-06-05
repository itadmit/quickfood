"use client";

import { useEffect, useState } from "react";
import { usePos } from "@/components/pos/PosContext";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { PosCashKeypadModal } from "@/components/pos/PosNumericKeypad";
import { renderGrowWallet } from "@/components/customer/GrowPaymentSdk";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { IcoCheck } from "@/components/shared/Icons";
import { PosWalkInPromptModal } from "@/components/pos/PosWalkInPromptModal";

// Server error codes that come back in Hebrew error.message most of the
// time, but occasionally as raw code strings (validation errors thrown
// from createOrder/Zod). Map the ones that the cashier will actually
// see to clear copy.
const ERROR_CODE_HEBREW: Record<string, string> = {
  required_group_missing: "חסרה בחירת תוספות חובה. ערוך את השורה ובחר את הקבוצה.",
  required_group_min: "מספר התוספות שנבחר נמוך מהמינימום הנדרש.",
  size_invalid: "הגודל לא תקין לפריט.",
  cart_empty: "הכרטיסייה ריקה.",
  restaurant_closed: "המסעדה סגורה כרגע.",
  branch_not_found: "סניף לא נמצא.",
  no_branch: "אין סניף משויך לקופאי.",
  no_open_shift: "אין משמרת פתוחה.",
  insufficient: "סכום המזומן נמוך מהחיוב.",
  already_paid: "ההזמנה כבר שולמה.",
  invalid_items: "פריט מההזמנה כבר אינו זמין.",
  amount_zero: "הסכום חייב להיות גדול מ-0.",
};

function translateError(payload: { code?: string; message?: string } | undefined): string {
  if (!payload) return "פעולה נכשלה";
  const fromMap = payload.code ? ERROR_CODE_HEBREW[payload.code] : undefined;
  if (fromMap) return fromMap;
  // Server messages are mostly already in Hebrew. Fall back to the raw
  // code when the message looks like a passed-through code (no spaces).
  if (payload.message && !/^[a-z_]+$/.test(payload.message)) return payload.message;
  return fromMap ?? payload.message ?? "פעולה נכשלה";
}

interface Props {
  amount: number;
  /** True for manual-amount sales (the "מספרים" button). False for ticket
   *  sales — the regular cart is dumped to the server as line items. */
  isManual: boolean;
  /** When set, this sheet settles an existing order (kiosk queue case).
   *  When NULL, it creates a fresh POS order before charging. */
  existingOrderId?: string;
  /** Pre-selected payment method — skips the in-sheet method picker and
   *  goes straight to the cash keypad or Grow wallet. POS cart buttons
   *  set this; queue flows leave it undefined so the cashier picks. */
  initialMethod?: Method;
  /** Cashier-applied discount in whole shekels (already capped at subtotal
   *  client-side). The sheet forwards it to the /sale endpoint when
   *  creating the order. */
  manualDiscount?: number;
  /** Cashier-applied tip in whole shekels. Already included in `amount`
   *  client-side, recorded separately on Order.tip via the /sale call. */
  tip?: number;
  onClose: () => void;
  onPaid: () => void;
}

type Method = "cash" | "card";

export function PosPaymentSheet({
  amount,
  isManual,
  existingOrderId,
  initialMethod,
  manualDiscount,
  tip,
  onClose,
  onPaid,
}: Props) {
  const { shift } = usePos();
  const { lines, customer, notes } = usePosCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [success, setSuccess] = useState<{ title: string; sub?: string } | null>(null);
  // Card payments need a real walk-in name (Grow PROD rejects placeholder
  // fullName). Cashier can fill it once per ticket; we remember it so a
  // retry after a Grow error doesn't re-prompt.
  const [walkIn, setWalkIn] = useState<{ name: string; phone?: string } | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  // Order ID the first /sale call materialized. Needed for the
  // split-payment flow where the cashier collects partial cash, then
  // chains into a card charge: the second call must hit the SAME order
  // (cash-collected then pay/initiate) rather than create a duplicate.
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // When the cashier clicked a specific method on the cart (cash/card),
  // skip the in-sheet picker and go straight to that flow. Queue/manual
  // sales without a pre-pick fall through to the picker render below.
  // Refs in deps array intentionally omit chooseCash/chooseCard — they're
  // defined below and would cause hoisting noise; running once on mount
  // is what we actually want.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!initialMethod) return;
    if (initialMethod === "cash") void chooseCash();
    else void chooseCard();
  }, []);

  // The Grow wallet is mounted at the shell level. We listen for the
  // shell-emitted "wallet closed" event so the sheet can clear itself
  // once the wallet UI goes away — payment status update comes from the
  // Grow S2S callback, not from the front-end close event.
  useEffect(() => {
    function onWalletClose() {
      if (cardOpen) {
        setCardOpen(false);
        // Wallet closed without a successful onSuccess → either the
        // cashier cancelled or it errored. Keep the ticket so they can
        // retry instead of silently clearing.
        setMethod(null);
        setError("התשלום לא הושלם. נסה שוב או בחר מזומן.");
      }
    }
    window.addEventListener("qf:pos:wallet-close", onWalletClose);
    return () => window.removeEventListener("qf:pos:wallet-close", onWalletClose);
  }, [cardOpen]);

  async function createOrCarryOrderId(paymentMethod: Method): Promise<string | null> {
    if (existingOrderId) return existingOrderId;
    if (createdOrderId) return createdOrderId;
    setBusy(true);
    try {
      const endpoint = isManual
        ? "/api/v1/merchant/pos/manual-sale"
        : "/api/v1/merchant/pos/sale";
      // Pass walk-in details when the cashier filled them in (card path).
      // Cash sales don't need this and the body omits them.
      const guestName = walkIn?.name;
      const guestPhone = walkIn?.phone;
      const body = isManual
        ? {
            amount,
            shift_id: shift?.id,
            customer_id: customer?.id ?? null,
            notes: notes || undefined,
            payment_method: paymentMethod,
            guest_name: guestName,
            guest_phone: guestPhone,
          }
        : {
            shift_id: shift?.id,
            customer_id: customer?.id ?? null,
            notes: notes || undefined,
            payment_method: paymentMethod,
            guest_name: guestName,
            guest_phone: guestPhone,
            manual_discount: manualDiscount,
            tip,
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
        setError(translateError(data?.error) || "יצירת ההזמנה נכשלה");
        return null;
      }
      const newOrderId = data.order.id as string;
      setCreatedOrderId(newOrderId);
      return newOrderId;
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
    // Walk-in name is required for card payment (Grow PROD requirement).
    // Queue orders already have a customer snapshot from the kiosk, and
    // attached customers obviously already have one — both bypass the
    // prompt. Otherwise we collect once and remember for retries.
    if (!existingOrderId && !customer && !walkIn) {
      setWalkInOpen(true);
      return;
    }
    await runCardCharge();
  }

  async function runCardCharge() {
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
        setError(translateError(data?.error) || "פתיחת תשלום אשראי נכשלה");
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

  async function confirmCash(received: number, change: number, isPartial: boolean) {
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
      const data = (await res.json().catch(() => ({}))) as {
        fully_paid?: boolean;
        remaining?: number;
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setError(translateError(data?.error) || "שמירת המזומן נכשלה");
        return;
      }
      // Split payment: cashier took partial cash, the remainder needs to
      // be charged on a card via Grow. Flip the order's intended method
      // to card and chain into the card flow — pay/initiate sees
      // cashCollected > 0 and asks Grow for the remainder only.
      if (!data.fully_paid) {
        setMethod(null);
        await fetch(`/api/v1/merchant/orders/${orderId}/payment-method`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ payment_method: "card" }),
        });
        // Walk-in name still required for Grow PROD. The amount Grow
        // shows is the remainder (pay/initiate already calculated it).
        if (!customer && !walkIn) {
          setWalkInOpen(true);
        } else {
          await runCardCharge();
        }
        return;
      }
      setMethod(null);
      setSuccess({
        title: "התשלום התקבל",
        sub: change > 0 ? `עודף ₪${change.toLocaleString("he-IL")}` : "ללא עודף",
      });
      // Auto-clear after 2.4s — long enough to read the עודף amount aloud
      // to the customer + hand the change over, short enough that the
      // next ring doesn't wait.
      window.setTimeout(() => {
        setSuccess(null);
        onPaid();
      }, 2400);
    } finally {
      setBusy(false);
    }
  }

  // Success overlay — green check, big total, optional "עודף ₪X". Always
  // renders OVER everything (the cash keypad is dismissed before this
  // mounts so they never overlap).
  if (success) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-8 text-center animate-qf-check-in">
          <div className="w-20 h-20 rounded-full bg-qf-green-soft border-4 border-qf-green-deep grid place-items-center mx-auto">
            <IcoCheck c="#0e7a3c" s={40} />
          </div>
          <h2 className="text-2xl font-black mt-4">{success.title}</h2>
          <div className="text-3xl font-black tnum mt-2">{formatPrice(amount)}</div>
          {success.sub && (
            <div className="text-base text-qf-green-deep font-bold mt-2">{success.sub}</div>
          )}
        </div>
      </div>
    );
  }

  // Walk-in customer prompt — only when card is chosen and there's
  // nobody attached yet. Cash skips this entirely. When the cashier
  // came in via the cart's direct "אשראי" button (initialMethod set),
  // cancelling the walk-in step closes the whole sheet — we never want
  // to dump them on the legacy "cash or card" picker behind it.
  if (walkInOpen) {
    return (
      <PosWalkInPromptModal
        amountLabel={formatPrice(amount)}
        onCancel={() => {
          setWalkInOpen(false);
          if (initialMethod) onClose();
        }}
        onConfirm={(data) => {
          setWalkIn(data);
          setWalkInOpen(false);
          void runCardCharge();
        }}
      />
    );
  }

  // While the Grow wallet is on screen, the SDK renders its own
  // overlay. We hide the sheet completely so there's no z-index race
  // — only a small floating banner stays to confirm we're waiting.
  if (cardOpen) {
    return (
      <div className="fixed bottom-6 inset-x-0 z-[40] flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-white border-2 border-black rounded-2xl shadow-[0_3px_0_#000] px-5 py-3 flex items-center gap-3">
          <span className="qf-spinner text-black text-base" aria-hidden />
          <div>
            <div className="font-bold text-sm">ממתין לתשלום אשראי</div>
            <div className="text-xs text-qf-mute">השלם בארנק התשלום של Grow</div>
          </div>
        </div>
      </div>
    );
  }

  if (method === "cash") {
    return (
      <PosCashKeypadModal
        total={amount}
        onCancel={() => {
          setMethod(null);
          // Same reasoning as the walk-in cancel above: when initialMethod
          // is set, the cashier explicitly picked cash from the cart, so
          // cancelling the keypad should drop them back at the cart — not
          // at the legacy method picker that lives below.
          if (initialMethod) onClose();
        }}
        onConfirm={confirmCash}
      />
    );
  }

  // Bail out of the legacy picker render entirely whenever initialMethod
  // was set. Without this guard, any transient state where method is null
  // and walkInOpen/cardOpen are false (e.g. during the awaits inside
  // runCardCharge or right after a partial-cash mutation) would flash
  // the picker for a few frames.
  if (initialMethod) return null;

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
      </div>
    </div>
  );
}
