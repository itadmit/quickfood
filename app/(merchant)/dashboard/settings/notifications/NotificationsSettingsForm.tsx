"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import { cn } from "@/lib/cn";

type Channel = "off" | "email" | "sms" | "whatsapp" | "whatsapp_managed";

export function NotificationsSettingsForm({
  initial,
  smsAvailable,
  whatsappAvailable,
  whatsappConnected,
  smsCreditsRemaining,
  managedActive,
}: {
  initial: { channel: Channel };
  smsAvailable: boolean;
  whatsappAvailable: boolean;
  whatsappConnected: boolean;
  smsCreditsRemaining: number;
  managedActive: boolean;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>(initial.channel);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function save() {
    setSaving(true);
    setSaveToast(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveToast({ kind: "err", msg: data?.error?.message ?? "שמירה נכשלה" });
        return;
      }
      setSaveToast({ kind: "ok", msg: "נשמר" });
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setSaveToast(null), 2000);
    }
  }

  const options: Array<{ val: Channel; label: string; available: boolean; note?: string }> = [
    { val: "email", label: "מייל בלבד", available: true, note: "ברירת מחדל · חינם" },
    { val: "sms", label: "SMS", available: smsAvailable },
    { val: "whatsapp", label: "WhatsApp", available: whatsappAvailable },
    { val: "whatsapp_managed", label: "ווטסאפ של QuickFood", available: managedActive, note: "מנוי" },
    { val: "off", label: "כבוי", available: true },
  ];

  return (
    <>
      <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-medium">ערוץ עדכוני הזמנה ללקוח</div>
          <p className="text-xs text-qf-mute leading-relaxed">
            עדכונים על אישור הזמנה, הזמנה מוכנה, יציאה למשלוח ומסירה. אישור הזמנה
            וחשבונית נשלחים תמיד גם במייל; הערוץ שתבחר נשלח בנוסף.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {options.map((opt) => {
              const selected = channel === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => opt.available && setChannel(opt.val)}
                  disabled={!opt.available}
                  aria-disabled={!opt.available}
                  className={cn(
                    "py-2.5 px-1 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center gap-0.5",
                    selected
                      ? "border-(--qf-primary) bg-qf-green-soft text-(--qf-deep)"
                      : opt.available
                        ? "border-qf-line-dash text-qf-ink2 hover:border-qf-line"
                        : "border-qf-line-dash text-qf-mute bg-qf-bg/60 cursor-not-allowed opacity-60",
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.note && (
                    <span className="text-[11px] font-normal text-qf-mute leading-none">{opt.note}</span>
                  )}
                </button>
              );
            })}
          </div>

          {!smsAvailable && (
            <p className="text-xs text-qf-mute mt-1">
              SMS דורש קרדיט בתשלום.{" "}
              <Link href="/dashboard/sms" className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)">
                רכישת קרדיט
              </Link>{" "}
              ({smsCreditsRemaining} זמינים).
            </p>
          )}
          {!whatsappAvailable && (
            <p className="text-xs text-qf-mute">
              WhatsApp דורש{" "}
              {!whatsappConnected ? (
                <>
                  חיבור פעיל ב־
                  <Link href="/dashboard/settings/whatsapp" className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)">
                    הגדרות WhatsApp
                  </Link>
                  {smsAvailable ? "." : " וגם קרדיט בתשלום."}
                </>
              ) : (
                <>
                  קרדיט בתשלום.{" "}
                  <Link href="/dashboard/sms" className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)">
                    רכישת קרדיט
                  </Link>
                </>
              )}
            </p>
          )}
          {!managedActive && (
            <p className="text-xs text-qf-mute">
              ווטסאפ של QuickFood (ללא הגבלה, ללא ניכוי קרדיט) מופעל כמנוי ב־
              <Link href="/dashboard/settings/reviews" className="text-(--qf-deep) underline underline-offset-2 hover:text-(--qf-primary)">
                הגדרות ביקורות
              </Link>
              .
            </p>
          )}
        </div>
      </div>
      <SettingsSaveBar saving={saving} onSave={save} toast={saveToast} />
    </>
  );
}
