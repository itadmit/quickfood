"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { Toggle as SharedToggle } from "@/components/shared/Toggle";
import { cn } from "@/lib/cn";

type Channel = "off" | "email" | "sms" | "whatsapp" | "whatsapp_managed";

interface Initial {
  enabled: boolean;
  public: boolean;
  channel: Channel;
  delayMinutes: number;
  smsSender: string;
}

interface ManagedStatus {
  active: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  basePrice: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ReviewsSettingsForm({
  initial,
  smsAvailable,
  whatsappAvailable,
  whatsappConnected,
  smsCreditsRemaining,
  managed,
  billingReady,
}: {
  initial: Initial;
  smsAvailable: boolean;
  whatsappAvailable: boolean;
  whatsappConnected: boolean;
  smsCreditsRemaining: number;
  managed: ManagedStatus;
  billingReady: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [managedError, setManagedError] = useState<string | null>(null);

  function set<K extends keyof Initial>(k: K, val: Initial[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/reviews", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: v.enabled,
          public: v.public,
          channel: v.channel,
          delay_minutes: v.delayMinutes,
          sms_sender: v.smsSender.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "שמירה נכשלה");
        return;
      }
      setToast("נשמר");
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function subscribeManaged() {
    setManagedBusy(true);
    setManagedError(null);
    try {
      const res = await fetch(
        "/api/v1/merchant/settings/reviews/whatsapp-managed/subscribe",
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManagedError(data?.error?.message ?? "הפעלת המנוי נכשלה");
        return;
      }
      // Subscribe succeeded — also flip the reviews channel to the new
      // managed track so the merchant doesn't have to click twice. The
      // PATCH validates against the just-mirrored subscription id.
      await fetch("/api/v1/merchant/settings/reviews", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "whatsapp_managed" }),
      });
      setV((x) => ({ ...x, channel: "whatsapp_managed" }));
      setSubscribeModalOpen(false);
      router.refresh();
    } finally {
      setManagedBusy(false);
    }
  }

  async function cancelManaged() {
    if (
      !confirm(
        "מנוי ווטסאפ ביקורות יסתיים בתום תקופת החיוב הנוכחית ולא יתחדש. אתה בטוח?",
      )
    )
      return;
    setManagedBusy(true);
    setManagedError(null);
    try {
      const res = await fetch(
        "/api/v1/merchant/settings/reviews/whatsapp-managed/cancel",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManagedError(data?.error?.message ?? "ביטול המנוי נכשל");
        return;
      }
      router.refresh();
    } finally {
      setManagedBusy(false);
    }
  }

  async function resumeManaged() {
    setManagedBusy(true);
    setManagedError(null);
    try {
      const res = await fetch(
        "/api/v1/merchant/settings/reviews/whatsapp-managed/resume",
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManagedError(data?.error?.message ?? "ביטול הביטול נכשל");
        return;
      }
      router.refresh();
    } finally {
      setManagedBusy(false);
    }
  }

  const disabled = !v.enabled;

  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-5">
      <Toggle
        label="הפעל ביקורות"
        description="כשמכובה, לקוחות לא יוכלו להגיש דירוג ולא יישלחו תזכורות"
        value={v.enabled}
        onChange={(b) => set("enabled", b)}
      />

      <div
        className={cn(
          "space-y-5 transition-opacity",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <Toggle
          label="הצג ביקורות ללקוחות"
          description="כשמופעל, יופיע עמוד ביקורות ציבורי לעסק שלך"
          value={v.public}
          onChange={(b) => set("public", b)}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">ערוץ שליחת בקשת דירוג</div>
          <p className="text-xs text-qf-mute">
            תישלח תזכורת אוטומטית ללקוח אחרי שההזמנה נמסרה
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(
              [
                { val: "off", label: "כבוי", available: true },
                { val: "email", label: "מייל", available: true },
                { val: "sms", label: "SMS", available: smsAvailable },
                { val: "whatsapp", label: "WhatsApp", available: whatsappAvailable },
              ] as Array<{ val: Channel; label: string; available: boolean }>
            ).map((opt) => {
              const selected = v.channel === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => opt.available && set("channel", opt.val)}
                  disabled={!opt.available}
                  aria-disabled={!opt.available}
                  className={cn(
                    "py-2.5 rounded-xl border text-sm font-medium transition",
                    selected
                      ? "border-(--qf-primary) bg-qf-green-soft text-(--qf-deep)"
                      : opt.available
                      ? "border-qf-line-dash text-qf-ink2 hover:border-qf-line"
                      : "border-qf-line-dash text-qf-mute bg-qf-bg/60 cursor-not-allowed opacity-60",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
            {/* Managed-WhatsApp: paid add-on (₪99/mo). When not subscribed,
                the click opens a confirmation modal instead of switching
                channels — the channel only flips once the subscription is
                live (and the webhook has mirrored the sub id). */}
            {(() => {
              const selected = v.channel === "whatsapp_managed";
              const isActive = managed.active;
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      set("channel", "whatsapp_managed");
                    } else {
                      setManagedError(null);
                      setSubscribeModalOpen(true);
                    }
                  }}
                  className={cn(
                    "py-2.5 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center gap-0.5",
                    selected
                      ? "border-(--qf-primary) bg-qf-green-soft text-(--qf-deep)"
                      : "border-qf-line-dash text-qf-ink2 hover:border-qf-line",
                  )}
                >
                  <span>ווטסאפ של QuickFood</span>
                  <span className="text-[11px] font-normal text-qf-mute leading-none">
                    {isActive ? "פעיל · ללא הגבלה" : `${managed.basePrice}₪/חודש · ללא הגבלה`}
                  </span>
                </button>
              );
            })()}
          </div>

          {v.channel === "whatsapp_managed" && managed.active && (
            <div className="mt-2 rounded-xl border border-qf-line-dash bg-qf-bg/40 px-3 py-2.5 text-xs space-y-1">
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
                    מנוי פעיל · {managed.basePrice}₪ + מע״מ לחודש · ללא הגבלת שליחות
                    {managed.currentPeriodEnd && (
                      <> · יחודש ב-{formatDate(managed.currentPeriodEnd)}</>
                    )}
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
              {managedError && (
                <div className="text-qf-tomato">{managedError}</div>
              )}
            </div>
          )}

          {v.channel === "email" && (
            <p className="text-xs text-qf-mute mt-1">
              כשבחור מייל, שדה אימייל יהפוך לחובה בצ׳קאאוט.
            </p>
          )}
          {!smsAvailable && (
            <p className="text-xs text-qf-mute mt-1">
              SMS דורש קרדיט בתשלום.{" "}
              <Link
                href="/dashboard/sms"
                className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)"
              >
                רכישת קרדיט
              </Link>
              {" "}({smsCreditsRemaining} זמינים).
            </p>
          )}
          {!whatsappAvailable && (
            <p className="text-xs text-qf-mute">
              WhatsApp דורש{" "}
              {!whatsappConnected ? (
                <>
                  חיבור פעיל ב־
                  <Link
                    href="/dashboard/settings/whatsapp"
                    className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)"
                  >
                    הגדרות WhatsApp
                  </Link>
                  {smsAvailable ? "." : " וגם קרדיט בתשלום."}
                </>
              ) : (
                <>
                  קרדיט בתשלום.{" "}
                  <Link
                    href="/dashboard/sms"
                    className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)"
                  >
                    רכישת קרדיט
                  </Link>
                </>
              )}
            </p>
          )}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-3",
            v.channel === "off" && "opacity-60 pointer-events-none",
          )}
        >
          <Field
            label="זמן השהיה לפני שליחה (דקות)"
            hint="ברירת מחדל 60 דקות אחרי שההזמנה נמסרה"
          >
            <input
              type="number"
              min={5}
              max={1440}
              value={v.delayMinutes}
              onChange={(e) =>
                set("delayMinutes", Math.max(5, Math.min(1440, parseInt(e.target.value, 10) || 60)))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
            />
          </Field>
          <Field
            label="שם השולח ב-SMS"
            hint="עד 11 תווים באנגלית/ספרות (דרישת ספק)"
          >
            <input
              value={v.smsSender}
              onChange={(e) => set("smsSender", e.target.value.slice(0, 11))}
              maxLength={11}
              dir="ltr"
              placeholder="QuickFood"
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-qf-line-soft">
        <div className="text-sm">
          {toast && (
            <span className="inline-flex items-center gap-1.5 text-qf-green-deep">
              <IcoCheck c="currentColor" s={14} />
              {toast}
            </span>
          )}
          {error && <span className="text-qf-tomato">{error}</span>}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-qf-line p-5 max-w-sm w-full space-y-4">
        <div className="space-y-1">
          <div className="font-semibold">הפעלת ווטסאפ של QuickFood</div>
          <div className="text-sm text-qf-ink2">
            שליחת בקשות ביקורת ללקוחות בוואטסאפ של QuickFood, ללא הגבלת שליחות
            בחודש. השליחות לא מנכות קרדיט SMS.
          </div>
        </div>

        <div className="rounded-xl border border-qf-line-dash bg-qf-bg/50 p-3 text-sm space-y-0.5">
          <div className="font-medium">
            {basePrice}₪ + מע״מ / חודש
          </div>
          <div className="text-xs text-qf-mute">
            סה״כ {totalWithVat}₪ כולל מע״מ · חיוב חודשי על הכרטיס השמור
          </div>
        </div>

        {!billingReady && (
          <div className="text-xs text-qf-tomato">
            יש להשלים{" "}
            <Link
              href="/dashboard/billing"
              className="underline underline-offset-2"
            >
              הגדרת חיוב
            </Link>{" "}
            (שמירת כרטיס אשראי) לפני הפעלת המנוי.
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
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
      {hint && <div className="text-xs text-qf-mute">{hint}</div>}
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <span className="mt-0.5">
        <SharedToggle checked={value} onChange={onChange} aria-label={label} />
      </span>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-qf-mute mt-0.5">{description}</div>
      </div>
    </label>
  );
}
