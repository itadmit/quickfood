"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoTrash } from "@/components/shared/Icons";

interface Props {
  tenantName: string;
}

/**
 * "Reopen the store from scratch" action — clears menu, marketing,
 * branding visuals, reviews, etc. and resets the Tenant row to the
 * defaults a brand-new merchant would see. Owner-only on the server
 * side. Forces the merchant to type the store name to confirm so a
 * stray click can't nuke the account.
 *
 * After a successful reset we send the merchant back to /dashboard
 * and `router.refresh()` so the welcome overlay (which re-shows
 * because we cleared `onboardingDismissedAt`) is the first thing
 * they see — same flow as day-one.
 */
export function ResetStore({ tenantName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMatches = typed.trim() === tenantName;

  async function onConfirm() {
    if (!nameMatches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm_name: typed.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message || "האיפוס נכשל");
        return;
      }
      setOpen(false);
      router.push("/dashboard");
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
        className="bg-qf-tomato hover:bg-[#a8381b] text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 transition"
      >
        <IcoTrash s={16} c="#fff" />
        איפוס מוחלט של החנות
      </button>

      <p className="text-xs text-qf-mute leading-relaxed max-w-xl">
        מאפס את התפריט, הקטגוריות, התוספות, הקופונים, הקמפיינים,
        הביקורות, השליחים, אזורי המשלוח, ה-webhooks, הלוגו, ה-cover,
        ה&quot;אודות&quot;, סוג העסק, ערכת הצבעים, והגדרות הצ׳קאוט.
        חוזרים למסך הברוך-הבא כאילו זה הרגע הראשון. <b>היסטוריית
        ההזמנות, הלקוחות, הצוות, יתרת SMS ופרטי החיוב נשמרים.</b>
      </p>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl border-2 border-black w-full max-w-md p-6 shadow-[0_6px_0_#000]">
            <header className="mb-3">
              <h3 className="text-lg font-black text-qf-tomato">
                איפוס מוחלט של החנות
              </h3>
              <p className="text-sm text-black/70 mt-1 leading-relaxed">
                פעולה לא הפיכה. כדי לאשר, הקלידו את שם החנות{" "}
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
                    <span>מאפס…</span>
                  </>
                ) : (
                  "כן, אפס הכל"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
