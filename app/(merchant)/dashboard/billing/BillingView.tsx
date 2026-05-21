"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

interface TenantBilling {
  name: string;
  billingCustomerId: string | null;
  baseSubscriptionId: string | null;
  paymentMethodId: string | null;
  setupCompletedAt: string | null;
  trialEndsAt: string | null;
  smsCreditsRemaining: number;
}

export function BillingView({
  tenant,
  justReturnedFromSetup,
  justReturnedFromFailure,
}: {
  tenant: TenantBilling;
  justReturnedFromSetup: boolean;
  justReturnedFromFailure: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPaymentMethod = !!tenant.paymentMethodId;
  const setupComplete = !!tenant.setupCompletedAt && hasPaymentMethod;
  const trialEnd = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const trialExpired = trialEnd ? trialEnd.getTime() < Date.now() : false;

  type Status = "active" | "trial_active" | "trial_expired" | "awaiting";
  const status: Status = setupComplete
    ? "active"
    : trialExpired
      ? "trial_expired"
      : trialEnd
        ? "trial_active"
        : "awaiting";

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/billing/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "פתיחת ההגדרה נכשלה");
        return;
      }
      if (data?.setup_url) {
        window.location.href = data.setup_url;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl lg:text-2xl font-bold">חיוב ומנוי</h1>
        <p className="text-xs lg:text-sm text-qf-mute">
          התשלום עובר דרך Quick Commerce Billing — כרטיס אחד, חשבונית אחת.
        </p>
      </header>

      {justReturnedFromSetup && status === "active" && (
        <div className="bg-qf-green-soft border border-(--qf-primary)/30 rounded-2xl px-4 py-3 text-sm">
          המנוי הופעל בהצלחה. תודה!
        </div>
      )}
      {justReturnedFromSetup && status !== "active" && (
        <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-2xl px-4 py-3 text-sm">
          חזרת מהגדרת התשלום. אנחנו ממתינים לאישור הסופי מהבנק — זה עשוי לקחת
          כמה דקות. רענן את הדף בעוד דקה.
        </div>
      )}
      {justReturnedFromFailure && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 rounded-2xl px-4 py-3 text-sm text-qf-tomato">
          הגדרת התשלום נכשלה. אפשר לנסות שוב.
        </div>
      )}

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">מנוי פלטפורמה</h2>
            <p className="text-xs text-qf-mute mt-0.5">
              ₪299 + מע״מ לחודש · מתחדש אוטומטית
            </p>
          </div>
          <StatusBadge status={status} trialDaysLeft={trialDaysLeft} />
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Row label="עמלת עסקה">0.5% מכל הזמנה (מחויב סוף חודש)</Row>
          {trialEnd && !setupComplete && (
            <Row label="ניסיון">
              {trialExpired ? (
                <span className="text-qf-tomato">הסתיים</span>
              ) : (
                <span>נותרו {trialDaysLeft} ימים</span>
              )}
            </Row>
          )}
          <Row label="אמצעי תשלום שמור">{hasPaymentMethod ? "כן" : "לא"}</Row>
        </div>

        {!setupComplete && (
          <div className="mt-5 border-t border-qf-line-soft pt-4">
            <button
              type="button"
              onClick={startSetup}
              disabled={busy}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
            >
              {busy
                ? "פותח..."
                : hasPaymentMethod
                  ? "החלפת אמצעי תשלום"
                  : "השלמת תשלום ופתיחת מנוי (₪299 + מע״מ)"}
            </button>
            <p className="text-xs text-qf-mute mt-2">
              ייפתח דף תשלום מאובטח של QuickBilling/PayPlus. בסיום החיוב הראשון של ₪299 + מע״מ ישמר טוקן והמנוי מתחיל אוטומטית.
            </p>
            {error && (
              <div className="mt-2 text-sm text-qf-tomato">{error}</div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">SMS</h2>
            <p className="text-xs text-qf-mute mt-0.5">
              חבילות חד-פעמיות שמוסיפות הודעות ליתרה
            </p>
          </div>
          <div className="text-sm">
            <span className="text-qf-mute">יתרה: </span>
            <span className="font-semibold tnum">{tenant.smsCreditsRemaining}</span>
          </div>
        </div>
        <div className="mt-4 border-t border-qf-line-soft pt-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard/sms")}
            className="text-sm text-(--qf-deep) underline"
          >
            ניהול חבילות SMS ובדיקת שליחה →
          </button>
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-qf-mute">{label}</div>
      <div className="text-end">{children}</div>
    </div>
  );
}

function StatusBadge({
  status,
  trialDaysLeft,
}: {
  status: "active" | "trial_active" | "trial_expired" | "awaiting";
  trialDaysLeft: number;
}) {
  const map: Record<typeof status, { label: string; cls: string }> = {
    active: { label: "פעיל", cls: "bg-qf-green-soft text-qf-green-deep" },
    trial_active: {
      label: `ניסיון · ${trialDaysLeft} ימים`,
      cls: "bg-qf-yolk-soft text-qf-ink2",
    },
    trial_expired: { label: "ניסיון הסתיים", cls: "bg-qf-tomato-soft text-qf-tomato" },
    awaiting: { label: "טרם הוגדר", cls: "bg-qf-tomato-soft text-qf-tomato" },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "shrink-0 text-[11px] tracking-wide rounded-full px-2.5 py-1 font-medium",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}
