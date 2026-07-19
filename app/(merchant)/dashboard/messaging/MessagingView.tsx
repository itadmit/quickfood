"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import { Toggle } from "@/components/shared/Toggle";
import { Modal } from "@/components/shared/Modal";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { cn } from "@/lib/cn";
import {
  ORDER_NOTIFY_EVENTS,
  type OrderNotifySettings,
  type OrderNotifyEvent,
  type NotifyChannel,
} from "@/lib/messaging/notify-settings";
import { defaultTemplate, TEXT_TOKENS } from "@/lib/messaging/notify-templates";

type Tier = "silver" | "gold" | "platinum";
type Tab = "balance" | "notifications" | "club";

const VAT_RATE = 0.18;
const PACKAGES: Array<{ key: "starter" | "growth" | "scale"; base: number; quota: number; label: string }> = [
  { key: "starter", base: 39, quota: 300, label: "Starter" },
  { key: "growth", base: 79, quota: 1000, label: "Growth" },
  { key: "scale", base: 299, quota: 5000, label: "Scale" },
];

const EVENT_LABEL: Record<OrderNotifyEvent, string> = {
  confirmed: "אישור הזמנה",
  ready: "הזמנה מוכנה",
  on_the_way: "יצא לדרך / במשלוח",
  delivered: "נמסר",
};

const CHANNEL_LABEL: Record<NotifyChannel, string> = {
  off: "כבוי",
  email: "מייל",
  sms: "SMS",
  whatsapp: "וואטסאפ",
  whatsapp_managed: "ווטסאפ של QuickFood",
};

interface Availability {
  smsAvailable: boolean;
  whatsappEnabled: boolean;
  whatsappConnected: boolean;
  whatsappAvailable: boolean;
  managedActive: boolean;
}

interface Managed {
  active: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  basePrice: number;
}

interface LogRow {
  id: string;
  to: string;
  body: string;
  channel: string;
  kind: string;
  status: string;
  providerMsg: string | null;
  createdAt: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function channelAvailable(ch: NotifyChannel, a: Availability): boolean {
  if (ch === "off" || ch === "email") return true;
  if (ch === "sms") return a.smsAvailable;
  if (ch === "whatsapp") return a.whatsappAvailable;
  return a.managedActive;
}

export function MessagingView({
  balance: initialBalance,
  whatsappBalance: initialWaBalance,
  smsSender: initialSender,
  billingReady,
  whatsapp,
  orderEvents,
  merchantNewOrder,
  review,
  availability,
  managed,
  tiers,
  audience,
  logs,
}: {
  balance: number;
  whatsappBalance: number;
  smsSender: string;
  billingReady: boolean;
  whatsapp: { token: string; instanceId: string };
  orderEvents: OrderNotifySettings;
  merchantNewOrder: { email: boolean; whatsapp: boolean };
  review: { enabled: boolean; public: boolean; channel: NotifyChannel; delayMinutes: number };
  availability: Availability;
  managed: Managed;
  tiers: Record<Tier, string>;
  audience: Array<{ tier: Tier; hasEmail: boolean; hasPhone: boolean }>;
  logs: LogRow[];
}) {
  const [tab, setTab] = useState<Tab>("balance");
  const [balance, setBalance] = useState(initialBalance);
  const [waBalance, setWaBalance] = useState(initialWaBalance);
  const hasCredits = balance > 0;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        chip="דיוור"
        title="דיוור והתראות"
        subtitle="יתרת הודעות, התראות ללקוח ודיוור למועדון - הכל במקום אחד"
      />

      <nav className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {([
          { id: "balance", label: "יתרה ורכישה" },
          { id: "notifications", label: "התראות" },
          { id: "club", label: hasCredits ? "דיוור מועדון" : "דיוור מועדון (נעול)" },
        ] as Array<{ id: Tab; label: string }>).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition border-2",
              tab === t.id
                ? "bg-black text-[#F8CB1E] border-black"
                : "bg-white text-black/65 border-transparent hover:bg-black/[0.04] hover:text-black",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "balance" && (
        <BalanceTab
          balance={balance}
          setBalance={setBalance}
          waBalance={waBalance}
          setWaBalance={setWaBalance}
          smsSender={initialSender}
          billingReady={billingReady}
          whatsapp={whatsapp}
          availability={availability}
          managed={managed}
          logs={logs}
        />
      )}
      {tab === "notifications" && (
        <NotificationsTab
          orderEvents={orderEvents}
          merchantNewOrder={merchantNewOrder}
          review={review}
          smsSender={initialSender}
          availability={availability}
        />
      )}
      {tab === "club" && (
        <ClubTab
          hasCredits={hasCredits}
          balance={balance}
          setBalance={setBalance}
          tiers={tiers}
          audience={audience}
          smsAvailable={availability.smsAvailable}
          whatsappAvailable={availability.whatsappAvailable}
          onGoBuy={() => setTab("balance")}
        />
      )}
    </div>
  );
}

/* ─────────────────────── Tab 1: balance & purchase ─────────────────────── */

function BalanceTab({
  balance,
  setBalance,
  waBalance,
  setWaBalance,
  smsSender,
  billingReady,
  whatsapp,
  availability,
  managed,
  logs,
}: {
  balance: number;
  setBalance: (n: number) => void;
  waBalance: number;
  setWaBalance: (n: number) => void;
  smsSender: string;
  billingReady: boolean;
  whatsapp: { token: string; instanceId: string };
  availability: Availability;
  managed: Managed;
  logs: LogRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [managedError, setManagedError] = useState<string | null>(null);

  async function buy(pkg: string, channel: "sms" | "whatsapp" = "sms") {
    setBusy(`${channel}:${pkg}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/merchant/sms/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ package: pkg, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? data?.error ?? "הרכישה נכשלה");
        return;
      }
      if (typeof data.credits_remaining === "number") {
        if (channel === "whatsapp") setWaBalance(data.credits_remaining);
        else setBalance(data.credits_remaining);
      }
      const charged = typeof data.total_amount === "number" ? ` · חויב ₪${data.total_amount.toFixed(2)}` : "";
      setSuccess(`נוספו ${data.added} הודעות ליתרת ${channel === "whatsapp" ? "וואטסאפ" : "SMS"}${charged}`);
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
        setTestResult({ ok: true, message: "הודעת הבדיקה נשלחה. בדקו את הטלפון." });
      } else {
        setTestResult({
          ok: false,
          message:
            status === "invalid_recipient"
              ? "מספר טלפון לא תקין (פורמט: 05XXXXXXXX)"
              : data.result?.providerMsg || `סטטוס: ${status}`,
        });
      }
    } finally {
      setTestBusy(false);
    }
  }

  async function subscribeManaged() {
    setManagedBusy(true);
    setManagedError(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/reviews/whatsapp-managed/subscribe", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManagedError(data?.error?.message ?? "הפעלת המנוי נכשלה");
        return;
      }
      setSubscribeModalOpen(false);
      router.refresh();
    } finally {
      setManagedBusy(false);
    }
  }

  async function cancelManaged() {
    if (!confirm("מנוי ווטסאפ של QuickFood יסתיים בתום תקופת החיוב הנוכחית ולא יתחדש. להמשיך?")) return;
    setManagedBusy(true);
    setManagedError(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/reviews/whatsapp-managed/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setManagedError(data?.error?.message ?? "ביטול המנוי נכשל");
      else router.refresh();
    } finally {
      setManagedBusy(false);
    }
  }

  async function resumeManaged() {
    setManagedBusy(true);
    setManagedError(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/reviews/whatsapp-managed/resume", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setManagedError(data?.error?.message ?? "ביטול הביטול נכשל");
      else router.refresh();
    } finally {
      setManagedBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
          <div className="text-xs text-qf-mute">יתרת SMS</div>
          <div className="text-2xl lg:text-3xl font-bold tnum mt-1">{balance.toLocaleString("he-IL")}</div>
          <div className="text-xs text-qf-mute mt-0.5">הודעות SMS זמינות</div>
        </div>
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
          <div className="text-xs text-qf-mute">יתרת וואטסאפ</div>
          <div className="text-2xl lg:text-3xl font-bold tnum mt-1">{waBalance.toLocaleString("he-IL")}</div>
          <div className="text-xs text-qf-mute mt-0.5">הודעות וואטסאפ זמינות</div>
        </div>
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
          <div className="text-xs text-qf-mute">שם השולח ב-SMS</div>
          <div className="text-base lg:text-lg font-semibold mt-1" dir="ltr">
            {smsSender || "-"}
          </div>
          <div className="text-xs text-qf-mute mt-0.5">משתנה בלשונית &quot;התראות&quot;.</div>
        </div>
      </div>

      {(success || error) && (
        <div>
          {success && (
            <div className="text-sm bg-qf-green-soft border border-(--qf-primary)/30 text-qf-green-deep rounded-xl px-3 py-2">
              {success}
            </div>
          )}
          {error && <div className="text-sm text-qf-tomato">{error}</div>}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">רכישת חבילת SMS</h2>
          <p className="text-xs lg:text-sm text-qf-mute">
            חיוב חד-פעמי מהאשראי השמור והוספת הודעות ליתרת ה-SMS. אין מנוי חודשי - קונים עוד מתי שצריך, היתרה מצטברת.
          </p>
        </div>
        {!billingReady && (
          <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-sm text-qf-ink2">
            יש להשלים{" "}
            <Link href="/dashboard/billing" className="underline underline-offset-2">
              הגדרת חיוב
            </Link>{" "}
            לפני רכישת חבילה.
          </div>
        )}
        <PackageGrid channel="sms" billingReady={billingReady} busy={busy} onBuy={buy} />
      </section>

      <WhatsappSection
        enabled={availability.whatsappEnabled}
        connected={availability.whatsappConnected}
        waBalance={waBalance}
        initial={whatsapp}
        billingReady={billingReady}
        busy={busy}
        onBuy={(pkg) => buy(pkg, "whatsapp")}
      />

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">ווטסאפ של QuickFood</h2>
            <p className="text-xs lg:text-sm text-qf-mute">
              מנוי חודשי לשליחת התראות וביקורות בוואטסאפ של QuickFood, ללא הגבלת שליחות וללא ניכוי מהיתרה.
            </p>
          </div>
          {managed.active ? (
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-qf-green-soft text-qf-green-deep text-xs font-bold">
              פעיל
            </span>
          ) : (
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-qf-line-soft text-qf-mute text-xs font-bold">
              {managed.basePrice}₪ + מע״מ / חודש
            </span>
          )}
        </div>
        {managed.active ? (
          <div className="rounded-xl border border-qf-line-dash bg-qf-bg/40 px-3 py-2.5 text-xs space-y-1">
            {managed.cancelAtPeriodEnd ? (
              <>
                <div className="text-qf-tomato">
                  המנוי יסתיים ב-{formatDate(managed.currentPeriodEnd)} ולא יתחדש.
                </div>
                <button
                  type="button"
                  onClick={resumeManaged}
                  disabled={managedBusy}
                  className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary) disabled:opacity-60"
                >
                  ביטול הביטול (חזרה לפעיל)
                </button>
              </>
            ) : (
              <>
                <div className="text-qf-ink2">
                  מנוי פעיל · {managed.basePrice}₪ + מע״מ לחודש
                  {managed.currentPeriodEnd && <> · יחודש ב-{formatDate(managed.currentPeriodEnd)}</>}
                </div>
                <button
                  type="button"
                  onClick={cancelManaged}
                  disabled={managedBusy}
                  className="text-qf-tomato underline underline-offset-2 hover:opacity-80 disabled:opacity-60"
                >
                  ביטול המנוי בסוף התקופה
                </button>
              </>
            )}
            {managedError && <div className="text-qf-tomato">{managedError}</div>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setManagedError(null);
              setSubscribeModalOpen(true);
            }}
            className="py-2 px-4 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
          >
            הפעלת מנוי
          </button>
        )}
      </section>

      {balance > 0 && (
        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">בדיקת SMS</h2>
            <p className="text-xs lg:text-sm text-qf-mute">
              שליחת הודעת בדיקה. הפלטפורמה סופגת את העלות - לא יורד מהיתרה.
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
              {testResult.message}
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
                <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-qf-line-soft text-qf-ink2">
                  {l.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-qf-mute flex-wrap">
                    <span className="uppercase tracking-wide font-medium text-qf-ink2">
                      {l.channel === "whatsapp" ? "WA" : "SMS"}
                    </span>
                    <span>·</span>
                    <span dir="ltr" className="tnum">{l.to}</span>
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

      {subscribeModalOpen && (
        <ManagedSubscribeModal
          basePrice={managed.basePrice}
          billingReady={billingReady}
          busy={managedBusy}
          error={managedError}
          onConfirm={subscribeManaged}
          onClose={() => setSubscribeModalOpen(false)}
        />
      )}
    </div>
  );
}

function ManagedSubscribeModal({
  basePrice,
  billingReady,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  basePrice: number;
  billingReady: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const totalWithVat = (basePrice * 1.18).toFixed(2);
  return (
    <Modal open onClose={onClose} closeOnBackdrop={!busy} size="sm" ariaLabel="הפעלת ווטסאפ של QuickFood">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        <div className="space-y-1">
          <div className="font-semibold">הפעלת ווטסאפ של QuickFood</div>
          <div className="text-sm text-qf-ink2">
            שליחת התראות וביקורות בוואטסאפ של QuickFood, ללא הגבלת שליחות בחודש. השליחות לא מנכות מהיתרה.
          </div>
        </div>
        <div className="rounded-xl border border-qf-line-dash bg-qf-bg/50 p-3 text-sm space-y-0.5">
          <div className="font-medium">{basePrice}₪ + מע״מ / חודש</div>
          <div className="text-xs text-qf-mute">סה״כ {totalWithVat}₪ כולל מע״מ · חיוב חודשי על הכרטיס השמור</div>
        </div>
        {!billingReady && (
          <div className="text-xs text-qf-tomato">
            יש להשלים{" "}
            <Link href="/dashboard/billing" className="underline underline-offset-2">
              הגדרת חיוב
            </Link>{" "}
            לפני הפעלת המנוי.
          </div>
        )}
        {error && <div className="text-xs text-qf-tomato">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm hover:border-qf-line disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !billingReady}
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {busy ? "מפעיל..." : `הפעל ב-${basePrice}₪/חודש`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PackageGrid({
  channel,
  billingReady,
  busy,
  onBuy,
}: {
  channel: "sms" | "whatsapp";
  billingReady: boolean;
  busy: string | null;
  onBuy: (pkg: string, channel: "sms" | "whatsapp") => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {PACKAGES.map((p) => {
        const total = p.base * (1 + VAT_RATE);
        const key = `${channel}:${p.key}`;
        return (
          <div key={p.key} className="rounded-xl border border-qf-line-dash p-4 flex flex-col">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold">{p.label}</div>
              <div className="text-end">
                <div className="tnum text-lg font-bold leading-none">
                  ₪{p.base}
                  <span className="text-xs font-normal text-qf-mute"> + מע״מ</span>
                </div>
                <div className="text-[10px] text-qf-mute tnum mt-0.5">₪{total.toFixed(2)} בפועל</div>
              </div>
            </div>
            <div className="text-xs text-qf-mute mt-1">
              {p.quota.toLocaleString("he-IL")} הודעות · ₪{((p.base / p.quota) * 1000).toFixed(1)} לאלף
            </div>
            <button
              type="button"
              onClick={() => onBuy(p.key, channel)}
              disabled={busy !== null || !billingReady}
              className="mt-3 py-2 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
            >
              {busy === key ? "מבצע רכישה..." : "רכוש"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * BYO-WhatsApp: connection (own iBot creds) + its own balance + top-up packages.
 * The connection is locked behind buying a WhatsApp package (whatsappEnabled).
 */
function WhatsappSection({
  enabled,
  connected,
  waBalance,
  initial,
  billingReady,
  busy,
  onBuy,
}: {
  enabled: boolean;
  connected: boolean;
  waBalance: number;
  initial: { token: string; instanceId: string };
  billingReady: boolean;
  busy: string | null;
  onBuy: (pkg: string) => void;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initial.token);
  const [instanceId, setInstanceId] = useState(initial.instanceId);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/v1/merchant/whatsapp/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() || null, instance_id: instanceId.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg({ ok: false, msg: data?.error?.message ?? "שמירה נכשלה" });
        return;
      }
      setSaveMsg({ ok: true, msg: "החיבור נשמר" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/merchant/whatsapp/test", {
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
      setTestResult(
        status === "sent"
          ? { ok: true, message: "הודעת הבדיקה נשלחה. בדקו את הוואטסאפ." }
          : {
              ok: false,
              message:
                status === "invalid_recipient"
                  ? "מספר טלפון לא תקין (פורמט: 05XXXXXXXX)"
                  : status === "not_configured"
                    ? "החיבור לא הוגדר. שמרו Token ו-Instance ID תקפים."
                    : data.result?.providerMsg || `סטטוס: ${status}`,
            },
      );
    } finally {
      setTestBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash p-4 lg:p-5 space-y-3">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">וואטסאפ (המספר שלך)</h2>
          <p className="text-xs lg:text-sm text-qf-mute">
            שליחת התראות וביקורות מ-WhatsApp העסקי שלכם, דרך iBot Chat. רכשו חבילת וואטסאפ כדי לפתוח את החיבור.
          </p>
        </div>
        {!billingReady && (
          <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-sm text-qf-ink2">
            יש להשלים{" "}
            <Link href="/dashboard/billing" className="underline underline-offset-2">
              הגדרת חיוב
            </Link>{" "}
            לפני רכישת חבילה.
          </div>
        )}
        <PackageGrid channel="whatsapp" billingReady={billingReady} busy={busy} onBuy={(pkg) => onBuy(pkg)} />
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">וואטסאפ (המספר שלך)</h2>
          <p className="text-xs lg:text-sm text-qf-mute">
            חיבור iBot Chat למספר העסקי שלכם. כל שליחה יורדת מיתרת הוואטסאפ ({waBalance.toLocaleString("he-IL")} זמינות).
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 px-2.5 py-1 rounded-full text-xs font-bold",
            connected ? "bg-qf-green-soft text-qf-green-deep" : "bg-qf-line-soft text-qf-mute",
          )}
        >
          {connected ? "מחובר" : "לא מחובר"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium block">Token (API key)</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            dir="ltr"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium block">Instance ID</label>
          <input
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            dir="ltr"
            placeholder="abc123-instance"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
          />
          <div className="text-xs text-qf-mute">מזהה ה-instance של חיבור הוואטסאפ שלכם ב-iBot.</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="py-2 px-4 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמירת חיבור"}
          </button>
          {saveMsg && (
            <span className={cn("text-sm", saveMsg.ok ? "text-qf-green-deep" : "text-qf-tomato")}>{saveMsg.msg}</span>
          )}
        </div>
      </div>

      <div className="border-t border-qf-line-soft pt-3 space-y-2">
        <div className="text-sm font-medium">בדיקת חיבור</div>
        <p className="text-xs text-qf-mute">שליחת הודעת בדיקה. הפלטפורמה סופגת את העלות - לא יורד מהיתרה.</p>
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
            disabled={testBusy || !connected || testPhone.trim().length < 9}
            className="px-4 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {testBusy ? "שולח..." : "שליחת בדיקה"}
          </button>
        </div>
        {!connected && <p className="text-xs text-qf-mute">יש לשמור Token ו-Instance ID לפני שליחת בדיקה.</p>}
        {testResult && (
          <div
            className={cn(
              "text-sm rounded-xl px-3 py-2 border",
              testResult.ok
                ? "bg-qf-green-soft border-(--qf-primary)/30 text-qf-green-deep"
                : "bg-qf-tomato-soft border-qf-tomato/40 text-qf-tomato",
            )}
          >
            {testResult.message}
          </div>
        )}
      </div>

      <div className="border-t border-qf-line-soft pt-3 space-y-3">
        <div className="text-sm font-medium">רכישת חבילת וואטסאפ</div>
        <PackageGrid channel="whatsapp" billingReady={billingReady} busy={busy} onBuy={(pkg) => onBuy(pkg)} />
      </div>
    </section>
  );
}

/* ─────────────────────── Tab 2: customer notifications ─────────────────────── */

function ChannelPicker({
  value,
  options,
  availability,
  onChange,
}: {
  value: NotifyChannel;
  options: NotifyChannel[];
  availability: Availability;
  onChange: (c: NotifyChannel) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const available = channelAvailable(opt, availability);
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => available && onChange(opt)}
            disabled={!available}
            className={cn(
              "py-2 px-3 rounded-xl border text-sm font-medium transition",
              selected
                ? "border-(--qf-primary) bg-qf-green-soft text-(--qf-deep)"
                : available
                  ? "border-qf-line-dash text-qf-ink2 hover:border-qf-line"
                  : "border-qf-line-dash text-qf-mute bg-qf-bg/60 cursor-not-allowed opacity-60",
            )}
          >
            {CHANNEL_LABEL[opt]}
          </button>
        );
      })}
    </div>
  );
}

const CHANNEL_SAMPLE_LABEL: Partial<Record<NotifyChannel, string>> = {
  sms: "SMS",
  whatsapp: "וואטסאפ",
  whatsapp_managed: "וואטסאפ",
};

/**
 * Single editable box, prefilled with the current text - the saved override if
 * any, otherwise the channel default (token form). Leaving it as the untouched
 * default keeps `text` empty so the merchant still gets the smart channel-aware
 * default at send time; editing it stores the override verbatim.
 */
function EventTextEditor({
  event,
  channel,
  value,
  onChange,
}: {
  event: OrderNotifyEvent;
  channel: NotifyChannel;
  value: string;
  onChange: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const seed = defaultTemplate(event, channel);
  const shown = value.length > 0 ? value : seed;
  const channelLabel = CHANNEL_SAMPLE_LABEL[channel] ?? "";
  const custom = value.trim().length > 0;

  return (
    <div className="pt-1">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)"
        >
          {custom ? "עריכת הטקסט (מותאם אישית)" : "צפייה / עריכה של טקסט ההודעה"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-qf-mute">
              טקסט ההודעה ({channelLabel})
            </span>
            {custom && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[11px] text-qf-tomato font-medium hover:underline"
              >
                איפוס לברירת מחדל
              </button>
            )}
          </div>
          <textarea
            value={shown}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            dir="rtl"
            className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm leading-relaxed"
            aria-label={`טקסט הודעה ל${EVENT_LABEL[event]}`}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {TEXT_TOKENS.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => onChange(`${shown}${shown && !shown.endsWith(" ") ? " " : ""}${t.token}`)}
                className="px-2 py-0.5 rounded-md bg-qf-line-soft text-qf-ink2 text-[11px] font-medium hover:bg-qf-line-dash"
                title={`הוספת ${t.label}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-qf-mute">
            המשתנים (כמו {"{order}"} ו-{"{waze}"}) מוחלפים אוטומטית בעת השליחה. הטקסט משתנה לפי הערוץ - וואטסאפ עשיר, SMS קצר.
          </p>
        </div>
      )}
    </div>
  );
}

function NotificationsTab({
  orderEvents,
  merchantNewOrder,
  review,
  smsSender,
  availability,
}: {
  orderEvents: OrderNotifySettings;
  merchantNewOrder: { email: boolean; whatsapp: boolean };
  review: { enabled: boolean; public: boolean; channel: NotifyChannel; delayMinutes: number };
  smsSender: string;
  availability: Availability;
}) {
  const router = useRouter();
  // Email is the free default channel; paid rails are opt-in per event.
  const ORDER_EVENT_CHANNELS: NotifyChannel[] = ["email", "sms", "whatsapp", "whatsapp_managed"];
  const REVIEW_CHANNELS: NotifyChannel[] = ["off", "email", "sms", "whatsapp", "whatsapp_managed"];

  // Coerce an `off` channel (not offered for order events - use the toggle
  // instead) to the free email default so the picker always has a valid pick.
  const initEvents = useMemo(() => {
    const out = {} as OrderNotifySettings;
    for (const ev of ORDER_NOTIFY_EVENTS) {
      const e = orderEvents[ev];
      out[ev] = {
        enabled: e.enabled,
        channel: ORDER_EVENT_CHANNELS.includes(e.channel) ? e.channel : "email",
        text: e.text ?? null,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderEvents]);

  const [events, setEvents] = useState<OrderNotifySettings>(initEvents);
  const [ownerAlert, setOwnerAlert] = useState(merchantNewOrder);
  const [rev, setRev] = useState(review);
  const [sender, setSender] = useState(smsSender);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function setEvent(ev: OrderNotifyEvent, patch: Partial<OrderNotifySettings[OrderNotifyEvent]>) {
    setEvents((x) => ({ ...x, [ev]: { ...x[ev], ...patch } }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/messaging/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          order_events: events,
          merchant_new_order: ownerAlert,
          review: {
            enabled: rev.enabled,
            public: rev.public,
            channel: rev.channel,
            delay_minutes: rev.delayMinutes,
          },
          sms_sender: sender.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ kind: "err", msg: data?.error?.message ?? "שמירה נכשלה" });
        return;
      }
      setToast({ kind: "ok", msg: "נשמר" });
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">התראה לבעל העסק על הזמנה חדשה</h2>
            <p className="text-xs text-qf-mute">
              איך לעדכן אתכם ברגע שנכנסת הזמנה חדשה, בנוסף להתראה בדשבורד ובאפליקציה.
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={ownerAlert.email}
              onChange={(e) => setOwnerAlert((x) => ({ ...x, email: e.target.checked }))}
              className="w-4 h-4 accent-(--qf-primary)"
            />
            <span>
              מייל
              <span className="text-xs text-qf-mute"> · נשלח לכתובת המייל של בעל החשבון</span>
            </span>
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={ownerAlert.whatsapp}
              onChange={(e) => setOwnerAlert((x) => ({ ...x, whatsapp: e.target.checked }))}
              className="w-4 h-4 accent-(--qf-primary)"
            />
            <span>
              וואטסאפ
              <span className="text-xs text-qf-mute"> · נשלח למספר הנייד של בעל החשבון, ללא עלות</span>
            </span>
          </label>
        </section>

        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">עדכוני סטטוס הזמנה ללקוח</h2>
            <p className="text-xs text-qf-mute">
              מה לשלוח ללקוח בכל שלב, ובאיזה ערוץ. מייל הוא ברירת המחדל וללא עלות; SMS ו-וואטסאפ נגבים מהיתרה.
            </p>
          </div>
          <label className="flex items-center justify-between gap-3 pb-1">
            <span className="text-sm font-medium">סמן הכל</span>
            <Toggle
              checked={ORDER_NOTIFY_EVENTS.every((ev) => events[ev].enabled)}
              onChange={(b) =>
                setEvents((x) => {
                  const next = { ...x } as OrderNotifySettings;
                  for (const ev of ORDER_NOTIFY_EVENTS) next[ev] = { ...next[ev], enabled: b };
                  return next;
                })
              }
              aria-label="סמן הכל"
            />
          </label>
          <div className="space-y-3">
            {ORDER_NOTIFY_EVENTS.map((ev) => (
              <div key={ev} className="rounded-xl border border-qf-line-dash p-3 space-y-2.5">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{EVENT_LABEL[ev]}</span>
                  <Toggle
                    checked={events[ev].enabled}
                    onChange={(b) => setEvent(ev, { enabled: b })}
                    aria-label={EVENT_LABEL[ev]}
                  />
                </label>
                {events[ev].enabled && (
                  <>
                    <ChannelPicker
                      value={events[ev].channel}
                      options={ORDER_EVENT_CHANNELS}
                      availability={availability}
                      onChange={(c) => setEvent(ev, { channel: c })}
                    />
                    {events[ev].channel === "email" ? (
                      <p className="text-xs text-qf-mute">
                        נשלח מייל עדכון קצר עם קישור למעקב. ללא עלות.
                      </p>
                    ) : (
                      <EventTextEditor
                        event={ev}
                        channel={events[ev].channel}
                        value={events[ev].text ?? ""}
                        onChange={(t) => setEvent(ev, { text: t })}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">בקשת ביקורת אחרי הזמנה</span>
              <span className="block text-xs text-qf-mute">תזכורת אוטומטית ללקוח אחרי שההזמנה נמסרה</span>
            </span>
            <Toggle checked={rev.enabled} onChange={(b) => setRev((x) => ({ ...x, enabled: b }))} aria-label="הפעלת ביקורות" />
          </label>

          <div className={cn("space-y-4 transition-opacity", !rev.enabled && "opacity-50 pointer-events-none")}>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">הצגת ביקורות ללקוחות</span>
                <span className="block text-xs text-qf-mute">עמוד ביקורות ציבורי בחנות</span>
              </span>
              <Toggle checked={rev.public} onChange={(b) => setRev((x) => ({ ...x, public: b }))} aria-label="הצגת ביקורות" />
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium">ערוץ שליחה</div>
              <ChannelPicker
                value={rev.channel}
                options={REVIEW_CHANNELS}
                availability={availability}
                onChange={(c) => setRev((x) => ({ ...x, channel: c }))}
              />
              {rev.channel === "email" && (
                <p className="text-xs text-qf-mute">כשבוחרים מייל, שדה האימייל יהפוך לחובה בצ׳קאאוט.</p>
              )}
            </div>

            <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", rev.channel === "off" && "opacity-60 pointer-events-none")}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">זמן השהיה לפני שליחה (דקות)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={rev.delayMinutes}
                  onChange={(e) =>
                    setRev((x) => ({ ...x, delayMinutes: Math.max(5, Math.min(1440, parseInt(e.target.value, 10) || 60)) }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
                />
                <div className="text-xs text-qf-mute">ברירת מחדל 60 דקות אחרי מסירה</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-2">
          <label className="text-sm font-medium block">שם השולח ב-SMS</label>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value.slice(0, 11))}
            maxLength={11}
            dir="ltr"
            placeholder="QuickFood"
            className="w-full sm:max-w-xs px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
          <div className="text-xs text-qf-mute">עד 11 תווים באנגלית/ספרות (דרישת ספק ה-SMS).</div>
        </section>
      </div>
      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </>
  );
}

/* ─────────────────────── Tab 3: club mailing ─────────────────────── */

const TIER_KEYS: Tier[] = ["silver", "gold", "platinum"];

function ClubTab({
  hasCredits,
  balance,
  setBalance,
  tiers,
  audience,
  smsAvailable,
  whatsappAvailable,
  onGoBuy,
}: {
  hasCredits: boolean;
  balance: number;
  setBalance: (n: number) => void;
  tiers: Record<Tier, string>;
  audience: Array<{ tier: Tier; hasEmail: boolean; hasPhone: boolean }>;
  smsAvailable: boolean;
  whatsappAvailable: boolean;
  onGoBuy: () => void;
}) {
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const [tier, setTier] = useState<"all" | Tier>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const count = useMemo(
    () =>
      audience.filter(
        (r) => (tier === "all" || r.tier === tier) && (channel === "email" ? r.hasEmail : r.hasPhone),
      ).length,
    [audience, tier, channel],
  );

  async function send() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/loyalty/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          tier,
          subject: channel === "email" ? subject : undefined,
          body,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { sent?: number; total?: number; remaining?: number; error?: { message?: string } }
        | null;
      if (typeof data?.remaining === "number") setBalance(data.remaining);
      if (!res.ok) {
        setToast({ kind: "err", msg: data?.error?.message ?? "השליחה נכשלה" });
        return;
      }
      setToast({ kind: "ok", msg: `נשלח ל-${data?.sent ?? 0} מתוך ${data?.total ?? 0} נמענים` });
    } catch {
      setToast({ kind: "err", msg: "השליחה נכשלה, נסו שוב" });
    } finally {
      setBusy(false);
    }
  }

  if (!hasCredits) {
    return (
      <section className="bg-white rounded-2xl border border-qf-line-dash p-8 text-center space-y-3">
        <h2 className="text-lg font-semibold">דיוור מועדון נעול</h2>
        <p className="text-sm text-qf-mute max-w-md mx-auto">
          שליחת מבצעים והטבות לחברי המועדון נפתחת אחרי רכישת חבילת הודעות. רכשו חבילה כדי להתחיל לדוור.
        </p>
        <button
          type="button"
          onClick={onGoBuy}
          className="py-2.5 px-5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
        >
          לרכישת חבילה
        </button>
      </section>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-qf-line-dash focus:border-(--qf-primary) bg-white px-3 py-2.5 text-sm outline-none";

  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">דיוור לחברי המועדון</h2>
          <p className="text-xs text-qf-mute">שליחת מבצעים והטבות לפי מסלול. אימייל ו-SMS דרך Poply, וואטסאפ דרך iBot.</p>
        </div>
        <div className="text-xs text-qf-mute">
          יתרה: <span className="font-bold text-qf-ink2">{balance.toLocaleString("he-IL")}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium">ערוץ</span>
        <div className="flex flex-wrap gap-2">
          {([
            { id: "email" as const, label: "אימייל", available: true },
            { id: "sms" as const, label: "SMS", available: smsAvailable },
            { id: "whatsapp" as const, label: "וואטסאפ", available: whatsappAvailable },
          ]).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => c.available && setChannel(c.id)}
              disabled={!c.available}
              className={cn(
                "py-2 px-3 rounded-xl border text-sm font-medium transition",
                channel === c.id
                  ? "border-(--qf-primary) bg-qf-green-soft text-(--qf-deep)"
                  : c.available
                    ? "border-qf-line-dash text-qf-ink2 hover:border-qf-line"
                    : "border-qf-line-dash text-qf-mute bg-qf-bg/60 cursor-not-allowed opacity-60",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium block">קהל יעד</label>
          <select value={tier} onChange={(e) => setTier(e.target.value as "all" | Tier)} className={inputCls + " font-medium"}>
            <option value="all">כל חברי המועדון</option>
            {TIER_KEYS.map((t) => (
              <option key={t} value={t}>
                {tiers[t]} בלבד
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <div className="text-sm text-qf-mute">
            נמענים מתאימים: <span className="font-bold text-qf-ink2">{count}</span>
          </div>
        </div>
      </div>

      {channel === "email" && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium block">נושא</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="לדוגמה: מבצע מיוחד לחברי המועדון" />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium block">תוכן ההודעה</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputCls} placeholder="כתבו כאן את ההודעה לחברי המועדון..." />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={busy || body.trim().length === 0 || count === 0}
          className="px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
        >
          {busy ? "שולח..." : "שליחת דיוור"}
        </button>
        {toast && (
          <span className={cn("text-sm font-medium", toast.kind === "ok" ? "text-qf-green-deep" : "text-qf-tomato")}>
            {toast.msg}
          </span>
        )}
      </div>
    </section>
  );
}
