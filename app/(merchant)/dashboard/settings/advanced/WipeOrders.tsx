"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoTrash } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";

interface Props {
  tenantName: string;
  orderCount: number;
}

/**
 * "Wipe all orders" - the test-order cleanup. Deletes every order and
 * restarts numbering from 1, leaving menu / customers / billing intact.
 * Owner-only server-side; type-the-store-name confirmation like the
 * full store reset.
 */
export function WipeOrders({ tenantName, orderCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const nameMatches = typed.trim() === tenantName;

  async function onConfirm() {
    if (!nameMatches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant/wipe-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm_name: typed.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message || "המחיקה נכשלה");
        return;
      }
      setDone(body?.deleted?.orders ?? 0);
      setOpen(false);
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setTyped("");
          setOpen(true);
        }}
        disabled={orderCount === 0 && done === null}
        className="bg-qf-tomato hover:bg-[#a8381b] text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IcoTrash s={16} c="#fff" />
        מחיקת כל ההזמנות ({orderCount})
      </button>

      {done !== null && (
        <p className="text-xs font-bold text-qf-ink bg-qf-line-soft border border-qf-line rounded-lg px-3 py-2 inline-block">
          נמחקו {done} הזמנות. המספור יתחיל מחדש מההזמנה הבאה.
        </p>
      )}

      <p className="text-xs text-qf-mute leading-relaxed max-w-xl">
        מוחק את כל ההזמנות הקיימות (כולל הזמנות ניסיון) ומאתחל את מספור
        ההזמנות כך שההזמנה הבאה תתחיל שוב מ-1. עמלות שנרשמו על ההזמנות
        האלה ועדיין לא חויבו - מבוטלות אוטומטית. <b>התפריט, הלקוחות,
        הצוות ופרטי החיוב נשמרים.</b>
      </p>

      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        closeOnBackdrop={!busy}
        size="md"
        ariaLabel="מחיקת כל ההזמנות"
        className="border-2 border-black shadow-[0_6px_0_#000]"
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <header className="mb-3">
            <h3 className="text-lg font-black text-qf-tomato">
              מחיקת כל ההזמנות
            </h3>
            <p className="text-sm text-black/70 mt-1 leading-relaxed">
              {orderCount} הזמנות יימחקו לצמיתות והמספור יתחיל מחדש. פעולה
              לא הפיכה. כדי לאשר, הקלידו את שם החנות{" "}
              <b className="font-black">בדיוק</b> כפי שמופיע למטה.
            </p>
          </header>

          <div className="bg-qf-bg-dash border border-black/10 rounded-lg px-3 py-2 mb-2 text-sm font-bold tnum text-center select-all">
            {tenantName}
          </div>

          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            disabled={busy}
            placeholder="הקלידו את שם החנות"
            className="w-full px-3 py-2.5 rounded-lg border-2 border-black/40 focus:border-black outline-none text-sm font-bold transition"
          />

          {error && (
            <div className="mt-3 bg-qf-tomato/10 border border-qf-tomato/30 text-qf-tomato text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-bold text-black hover:bg-black/5 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!nameMatches || busy}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-qf-tomato hover:bg-[#a8381b] text-white disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
            >
              {busy ? (
                <>
                  <span className="qf-spinner" aria-hidden />
                  <span>מוחק…</span>
                </>
              ) : (
                "כן, מחק את כל ההזמנות"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
