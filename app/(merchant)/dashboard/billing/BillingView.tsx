"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import {
  BASE_PLAN_PRICE,
  NO_COMMISSION_PLAN_PRICE,
  type PlatformPlan,
} from "@/lib/billing-hub/plans";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;

interface TenantBilling {
  name: string;
  vatNumber: string | null;
  billingCustomerId: string | null;
  baseSubscriptionId: string | null;
  paymentMethodId: string | null;
  setupCompletedAt: string | null;
  trialEndsAt: string | null;
  smsCreditsRemaining: number;
  plan: PlatformPlan;
  /** Active negotiated price for the base plan, pre-VAT, or null. */
  introMonthlyPrice: number | null;
}

interface SubscriptionState {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  planChangePending: boolean;
}

const PLAN_INFO: Record<
  PlatformPlan,
  { title: string; price: number; commission: string }
> = {
  base: {
    title: "מסלול בסיס",
    price: BASE_PLAN_PRICE,
    commission: "0.5% מכל הזמנה + מע״מ (מחויב סוף חודש)",
  },
  no_commission: {
    title: "ללא עמלות",
    price: NO_COMMISSION_PLAN_PRICE,
    commission: "ללא עמלה על הזמנות",
  },
};

const otherPlan = (p: PlatformPlan): PlatformPlan =>
  p === "base" ? "no_commission" : "base";

export function BillingView({
  tenant,
  subscription,
  justReturnedFromSetup,
  justReturnedFromFailure,
}: {
  tenant: TenantBilling;
  subscription: SubscriptionState | null;
  justReturnedFromSetup: boolean;
  justReturnedFromFailure: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [vatNumber, setVatNumber] = useState(tenant.vatNumber ?? "");
  const [selectedPlan, setSelectedPlan] = useState<PlatformPlan>(tenant.plan);
  const [polling, setPolling] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollStartRef = useRef<number>(0);

  const hasPaymentMethod = !!tenant.paymentMethodId;
  const setupComplete = !!tenant.setupCompletedAt && hasPaymentMethod;
  // Before setup the merchant is choosing; after it, the plan on the tenant.
  const shownPlan: PlatformPlan = setupComplete ? tenant.plan : selectedPlan;
  const shownInfo = PLAN_INFO[shownPlan];
  // The intro price applies to the base plan only.
  const monthOnePrice =
    shownPlan === "base" && tenant.introMonthlyPrice != null
      ? tenant.introMonthlyPrice
      : shownInfo.price;

  // After the merchant returns from Grow, the hub fires our webhook out of
  // band. Until it lands the local Tenant row still shows the old "טרם
  // הוגדר" state. Poll every 2s for up to 60s and refresh the page when the
  // status flips, so the merchant doesn't have to refresh manually.
  useEffect(() => {
    if (!justReturnedFromSetup || setupComplete) return;
    let cancelled = false;
    pollStartRef.current = Date.now();
    setPolling(true);
    setPollTimedOut(false);

    async function tick() {
      try {
        const res = await fetch("/api/v1/merchant/billing/status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as
          | { setup_complete?: boolean; payment_method?: boolean }
          | null;
        if (data?.setup_complete || data?.payment_method) {
          if (!cancelled) {
            setPolling(false);
            router.refresh();
          }
          return true;
        }
      } catch {
        /* network blip - keep polling */
      }
      return false;
    }

    const timer = setInterval(async () => {
      if (cancelled) return;
      const done = await tick();
      if (done) {
        clearInterval(timer);
        return;
      }
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        clearInterval(timer);
        if (!cancelled) {
          setPolling(false);
          setPollTimedOut(true);
        }
      }
    }, POLL_INTERVAL_MS);

    // Fire the first attempt immediately so the spinner isn't a no-op for 2s.
    tick().then((done) => {
      if (done) clearInterval(timer);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [justReturnedFromSetup, setupComplete, router]);
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

  async function startSetup(
    contextType: "subscription_setup" | "card_update" = "subscription_setup",
  ) {
    if (!consent) {
      setError("יש לאשר את שמירת פרטי האשראי לפני המעבר להזנת כרטיס");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/billing/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept: true,
          context_type: contextType,
          vat_number: vatNumber.trim() || undefined,
          plan: contextType === "subscription_setup" ? selectedPlan : undefined,
        }),
      });
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

  async function cancelSub() {
    if (!confirm(
      "המנוי יסתיים בתום תקופת החיוב הנוכחית ולא יתחדש. אתה בטוח?",
    )) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "ביטול המנוי נכשל");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resumeSub() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/billing/resume", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "ביטול הביטול נכשל");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function switchPlan() {
    const target = otherPlan(tenant.plan);
    const info = PLAN_INFO[target];
    if (!confirm(
      `לעבור למסלול "${info.title}" (₪${info.price} + מע״מ לחודש)? המעבר ייכנס לתוקף בחידוש הבא של המנוי.`,
    )) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/billing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "מעבר המסלול נכשל");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeCard() {
    if (!consent) {
      setError("יש לאשר את שמירת פרטי האשראי לפני המעבר להחלפת הכרטיס");
      return;
    }
    await startSetup("card_update");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="חשבון"
        title="חיוב ומנוי"
        subtitle="התשלום עובר דרך Quick Commerce Billing - כרטיס אחד, חשבונית אחת"
      />

      {justReturnedFromSetup && status === "active" && (
        <div className="bg-qf-green-soft border border-(--qf-primary)/30 rounded-2xl px-4 py-3 text-sm">
          המנוי הופעל בהצלחה. תודה!
        </div>
      )}
      {justReturnedFromSetup && status !== "active" && polling && (
        <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-2xl px-4 py-3 text-sm flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-full border-2 border-qf-ink2 border-t-transparent animate-spin"
          />
          <span>
            התשלום אושר, מסיימים להפעיל את המנוי...
          </span>
        </div>
      )}
      {justReturnedFromSetup && status !== "active" && pollTimedOut && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 rounded-2xl px-4 py-3 text-sm text-qf-tomato">
          התשלום בוצע אך טרם קיבלנו את האישור הסופי. אנחנו מתעדים שזה קרה
          וננסה שוב באופן אוטומטי. נסה לרענן בעוד דקה.
        </div>
      )}
      {justReturnedFromFailure && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 rounded-2xl px-4 py-3 text-sm text-qf-tomato">
          הגדרת התשלום נכשלה. אפשר לנסות שוב.
        </div>
      )}

      <section
        className={cn(
          "bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 transition-opacity",
          polling && "opacity-60 pointer-events-none select-none",
        )}
        aria-busy={polling || undefined}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">מנוי פלטפורמה</h2>
            <p className="text-xs text-qf-mute mt-0.5">
              {shownInfo.title} · ₪{shownInfo.price} + מע״מ לחודש · מתחדש אוטומטית
            </p>
          </div>
          <StatusBadge status={status} trialDaysLeft={trialDaysLeft} />
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Row label="עמלת עסקה">{shownInfo.commission}</Row>
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
          {setupComplete && subscription?.currentPeriodEnd && (
            <Row label={subscription.cancelAtPeriodEnd ? "מסתיים בתאריך" : "מתחדש בתאריך"}>
              <span className="ltr-num font-mono text-xs">
                {subscription.currentPeriodEnd}
              </span>
            </Row>
          )}
        </div>

        {!setupComplete && (
          <div className="mt-5 border-t border-qf-line-soft pt-4 space-y-3">
            <fieldset>
              <legend className="mb-2 text-xs text-qf-ink2">בחירת מסלול</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(["base", "no_commission"] as const).map((p) => (
                  <PlanOption
                    key={p}
                    plan={p}
                    selected={selectedPlan === p}
                    introPrice={p === "base" ? tenant.introMonthlyPrice : null}
                    onSelect={() => setSelectedPlan(p)}
                  />
                ))}
              </div>
            </fieldset>
            <label className="block text-xs text-qf-ink2">
              <span className="mb-1 block">ח.פ / עוסק מורשה (לחשבונית)</span>
              <input
                type="text"
                inputMode="numeric"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                maxLength={20}
                placeholder="לא חובה"
                className="w-full sm:w-64 rounded-xl border border-qf-line-dash px-3 py-2 text-sm outline-none focus:border-(--qf-primary)"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-qf-ink2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setError(null);
                }}
                className="mt-0.5 w-4 h-4 accent-(--qf-primary)"
              />
              <span>
                אני מאשר/ת לשמור את פרטי כרטיס האשראי שלי לשם חיוב חודשי
                אוטומטי של ₪{shownInfo.price} + מע״מ עבור QuickFood
                {shownPlan === "base" ? ", ולשם חיוב עמלות ההזמנות" : ""}.
                ניתן לבטל בכל עת מתוך עמוד החיוב.
              </span>
            </label>
            <button
              type="button"
              onClick={() => startSetup("subscription_setup")}
              disabled={busy || !consent}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy
                ? "פותח..."
                : `השלמת תשלום ופתיחת מנוי (₪${monthOnePrice} + מע״מ)`}
            </button>
            <p className="text-xs text-qf-mute">
              ייפתח דף תשלום מאובטח של QuickBilling. בסיום החיוב הראשון של
              ₪{monthOnePrice} + מע״מ ישמר טוקן והמנוי מתחיל אוטומטית.
            </p>
            {error && (
              <div className="text-sm text-qf-tomato">{error}</div>
            )}
          </div>
        )}

        {setupComplete && (
          <div className="mt-5 border-t border-qf-line-soft pt-4 space-y-3">
            {subscription?.cancelAtPeriodEnd ? (
              <div className="bg-qf-tomato-soft border border-qf-tomato/40 rounded-xl px-3 py-2 text-xs text-qf-tomato">
                המנוי מסומן לסיום בתום התקופה. ניתן לבטל את הביטול עד תאריך הסיום.
              </div>
            ) : null}
            <div className="rounded-xl border border-qf-line-soft px-3 py-2.5 text-xs space-y-2">
              {subscription?.planChangePending ? (
                <div>
                  מתוזמן מעבר למסלול &quot;{PLAN_INFO[otherPlan(tenant.plan)].title}&quot;
                  {" "}(₪{PLAN_INFO[otherPlan(tenant.plan)].price} + מע״מ) בחידוש הבא
                  {subscription.currentPeriodEnd ? (
                    <>
                      {" "}·{" "}
                      <span className="ltr-num font-mono">{subscription.currentPeriodEnd}</span>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-qf-ink2">
                    מסלול חלופי: {PLAN_INFO[otherPlan(tenant.plan)].title} · ₪
                    {PLAN_INFO[otherPlan(tenant.plan)].price} + מע״מ לחודש ·{" "}
                    {PLAN_INFO[otherPlan(tenant.plan)].commission}
                  </span>
                  <button
                    type="button"
                    onClick={switchPlan}
                    disabled={busy || !!subscription?.cancelAtPeriodEnd}
                    className="px-3 py-1.5 rounded-lg bg-white border border-qf-line-dash font-medium hover:bg-qf-bg disabled:opacity-60"
                  >
                    מעבר למסלול הזה
                  </button>
                </div>
              )}
            </div>
            <label className="flex items-start gap-2 text-xs text-qf-ink2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setError(null);
                }}
                className="mt-0.5 w-4 h-4 accent-(--qf-primary)"
              />
              <span>
                אני מאשר/ת לשמור את פרטי כרטיס האשראי החדש לחיוב המנוי
                ועמלות ההזמנות. נדרש לפני החלפת הכרטיס.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={changeCard}
                disabled={busy || !consent}
                className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? "פותח..." : "החלפת כרטיס אשראי"}
              </button>
              {subscription?.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={resumeSub}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-white border border-qf-line-dash text-xs font-medium hover:bg-qf-bg disabled:opacity-60"
                >
                  ביטול הביטול (חזרה לפעיל)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelSub}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-white border border-qf-tomato/30 text-qf-tomato text-xs font-medium hover:bg-qf-tomato-soft disabled:opacity-60"
                >
                  ביטול המנוי בסוף התקופה
                </button>
              )}
            </div>
            {error && (
              <div className="text-sm text-qf-tomato">{error}</div>
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

function PlanOption({
  plan,
  selected,
  introPrice,
  onSelect,
}: {
  plan: PlatformPlan;
  selected: boolean;
  introPrice: number | null;
  onSelect: () => void;
}) {
  const info = PLAN_INFO[plan];
  return (
    <label
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3 py-3 cursor-pointer select-none transition-colors",
        selected
          ? "border-(--qf-primary) bg-qf-green-soft"
          : "border-qf-line-dash hover:bg-qf-bg",
      )}
    >
      <input
        type="radio"
        name="platform-plan"
        checked={selected}
        onChange={onSelect}
        className="mt-1 w-4 h-4 accent-(--qf-primary)"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold">{info.title}</span>
        <span className="block text-sm">
          <span className="tnum">₪{info.price}</span> + מע״מ לחודש
        </span>
        <span className="block text-xs text-qf-mute">
          {plan === "base" ? "+ 0.5% עמלה מכל הזמנה" : "0% עמלה על הזמנות"}
        </span>
        {introPrice != null && (
          <span className="block text-xs text-qf-ink2">
            מחיר היכרות: ₪{introPrice} + מע״מ
          </span>
        )}
      </span>
    </label>
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
