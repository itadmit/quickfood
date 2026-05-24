"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/merchant/v2/PageHeader";

type Package = "starter" | "growth" | "scale";
type Status =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped_no_balance"
  | "invalid_recipient";

// Prices are pre-VAT (base). The hub adds 18% and that's what hits the card.
const VAT_RATE = 0.18;
const PACKAGES: Array<{ key: Package; base: number; quota: number; label: string }> = [
  { key: "starter", base: 39, quota: 300, label: "Starter" },
  { key: "growth", base: 79, quota: 1000, label: "Growth" },
  { key: "scale", base: 299, quota: 5000, label: "Scale" },
];

const STATUS_LABEL: Record<Status, string> = {
  pending: "ממתינה",
  sent: "נשלחה",
  delivered: "נמסרה",
  failed: "נכשלה",
  skipped_no_balance: "ללא יתרה",
  invalid_recipient: "מספר לא תקין",
};

const STATUS_COLOR: Record<Status, string> = {
  pending: "bg-qf-line-soft text-qf-mute",
  sent: "bg-qf-green-soft text-qf-green-deep",
  delivered: "bg-qf-green-soft text-qf-green-deep",
  failed: "bg-qf-tomato-soft text-qf-tomato",
  skipped_no_balance: "bg-qf-yolk-soft text-qf-ink2",
  invalid_recipient: "bg-qf-tomato-soft text-qf-tomato",
};

interface LogRow {
  id: string;
  to: string;
  body: string;
  channel: string;
  kind: string;
  status: Status;
  providerMsg: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function SmsView({
  tenant,
  logs,
}: {
  tenant: { creditsRemaining: number; sender: string | null; billingReady: boolean };
  logs: LogRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Package | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true; status: string } | { ok: false; message: string } | null
  >(null);

  // Surface the test panel only once the merchant has credits to spend.
  const hasCredits = tenant.creditsRemaining > 0;

  async function buy(pkg: Package) {
    setBusy(pkg);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/merchant/sms/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ package: pkg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? data?.error ?? "הרכישה נכשלה");
        return;
      }
      const charged = typeof data.total_amount === "number"
        ? ` · חויב ₪${data.total_amount.toFixed(2)}`
        : "";
      setSuccess(`נוספו ${data.added} הודעות ליתרה${charged}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/merchant/sms/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testPhone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({ ok: false, message: data?.error?.message ?? "שליחה נכשלה" });
        return;
      }
      const status: string = data.result?.status ?? "unknown";
      if (status === "sent") {
        setTestResult({ ok: true, status });
        router.refresh();
      } else {
        const msg =
          status === "invalid_recipient"
            ? "מספר טלפון לא תקין (פורמט: 05XXXXXXXX)"
            : status === "failed"
              ? data.result?.providerMsg || "השליחה נכשלה אצל ספק ה-SMS"
              : `סטטוס: ${status}`;
        setTestResult({ ok: false, message: msg });
      }
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="תקשורת"
        title="הודעות"
        subtitle="חבילות, יתרה והיסטוריית שליחה — היתרה משותפת ל-SMS ול-WhatsApp"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
          <div className="text-xs text-qf-mute">יתרה נוכחית</div>
          <div className="text-2xl lg:text-3xl font-bold tnum mt-1">{tenant.creditsRemaining}</div>
          <div className="text-xs text-qf-mute mt-0.5">הודעות זמינות לשליחה</div>
        </div>
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
          <div className="text-xs text-qf-mute">שם השולח</div>
          <div className="text-base lg:text-lg font-semibold mt-1" dir="ltr">
            {tenant.sender || "—"}
          </div>
          <div className="text-xs text-qf-mute mt-0.5">עד 11 תווים. משתנה בהגדרות &gt; ביקורות.</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">רכישת חבילה</h2>
          <p className="text-xs lg:text-sm text-qf-mute">
            כל רכישה היא חיוב חד-פעמי מהאשראי השמור והוספת הודעות ליתרה. אין מנוי חודשי על SMS — קונים עוד מתי שצריך, היתרה מצטברת.
          </p>
        </div>
        {!tenant.billingReady && (
          <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-sm text-qf-ink2">
            יש להשלים הגדרת חיוב לפני רכישת חבילת SMS.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PACKAGES.map((p) => {
            const total = p.base * (1 + VAT_RATE);
            return (
              <div
                key={p.key}
                className="rounded-xl border border-qf-line-dash p-4 flex flex-col"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-end">
                    <div className="tnum text-lg font-bold leading-none">
                      ₪{p.base}
                      <span className="text-xs font-normal text-qf-mute"> + מע״מ</span>
                    </div>
                    <div className="text-[10px] text-qf-mute tnum mt-0.5">
                      ₪{total.toFixed(2)} בפועל
                    </div>
                  </div>
                </div>
                <div className="text-xs text-qf-mute mt-1">
                  {p.quota.toLocaleString("he-IL")} הודעות · ₪{((p.base / p.quota) * 1000).toFixed(1)} לאלף
                </div>
                <button
                  type="button"
                  onClick={() => buy(p.key)}
                  disabled={busy !== null || !tenant.billingReady}
                  className="mt-3 py-2 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
                >
                  {busy === p.key ? "מבצע רכישה..." : "רכוש"}
                </button>
              </div>
            );
          })}
        </div>
        {success && (
          <div className="text-sm bg-qf-green-soft border border-(--qf-primary)/30 text-qf-green-deep rounded-xl px-3 py-2">
            {success}
          </div>
        )}
        {error && <div className="text-sm text-qf-tomato">{error}</div>}
      </section>

      {hasCredits && (
        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">בדיקת SMS</h2>
            <p className="text-xs lg:text-sm text-qf-mute">
              שליחת הודעת בדיקה כדי לוודא שההגדרות עובדות. הפלטפורמה סופגת את העלות — לא יוריד מהיתרה.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="050-1234567"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-sm"
            />
            <button
              type="button"
              onClick={sendTest}
              disabled={testBusy || testPhone.trim().length < 9}
              className="px-4 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
            >
              {testBusy ? "שולח..." : "שליחת בדיקה"}
            </button>
          </div>
          {testResult && (
            <div
              className={cn(
                "text-sm rounded-xl px-3 py-2 border",
                testResult.ok
                  ? "bg-qf-green-soft border-(--qf-primary)/30 text-qf-green-deep"
                  : "bg-qf-tomato-soft border-qf-tomato/40 text-qf-tomato",
              )}
            >
              {testResult.ok
                ? "הודעת הבדיקה נשלחה. בדוק/י את הטלפון."
                : testResult.message}
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-2xl border border-qf-line-dash">
        <div className="px-4 lg:px-5 py-4 border-b border-qf-line-soft">
          <h2 className="text-base lg:text-lg font-semibold">היסטוריית שליחה</h2>
          <p className="text-xs text-qf-mute mt-0.5">50 הודעות אחרונות</p>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-qf-mute">עוד לא נשלחו הודעות.</div>
        ) : (
          <ul className="divide-y divide-qf-line-soft">
            {logs.map((l) => (
              <li key={l.id} className="px-4 lg:px-5 py-3 flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
                <span
                  className={cn(
                    "shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
                    STATUS_COLOR[l.status],
                  )}
                >
                  {STATUS_LABEL[l.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-qf-mute">
                    <span className="uppercase tracking-wide font-medium text-qf-ink2">
                      {l.channel === "whatsapp" ? "WA" : "SMS"}
                    </span>
                    <span>·</span>
                    <span dir="ltr" className="tnum">
                      {l.to}
                    </span>
                    <span>·</span>
                    <span>{l.kind}</span>
                    <span>·</span>
                    <RelativeTime date={l.createdAt} />
                  </div>
                  <div className="text-sm mt-0.5 wrap-break-word">{l.body}</div>
                  {l.providerMsg && l.status !== "sent" && l.status !== "delivered" && (
                    <div className="text-xs text-qf-tomato mt-0.5">{l.providerMsg}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
