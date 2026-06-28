"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/shared/Modal";

const SEGMENT_LABELS: Record<string, string> = {
  inactive_30d: "לא הזמינו 30 יום",
  inactive_60d: "לא הזמינו 60 יום",
  repeat: "לקוחות חוזרים (2+)",
  birthday_today: "ימי הולדת היום",
  all_direct: "כל הלקוחות הישירים",
};

const SUGGESTED_BODY: Record<string, string> = {
  inactive_30d: "מתגעגעים אליכם! חזרו להזמין ישירות מאיתנו וקבלו הטבה קטנה על ההזמנה הבאה.",
  inactive_60d: "עבר קצת זמן! יש לנו הטבה מיוחדת שתחזיר אתכם להזמין ישירות מאיתנו.",
  repeat: "תודה שאתם מזמינים שוב ושוב! הנה הטבה קטנה כאות הערכה.",
  birthday_today: "מזל טוב! לכבוד יום ההולדת מחכה לכם הטבה מיוחדת על ההזמנה הבאה.",
  all_direct: "תודה שאתם מזמינים ישירות מאיתנו! הנה עדכון קטן בשבילכם.",
};

const CHANNELS: { key: "email" | "sms" | "whatsapp"; label: string }[] = [
  { key: "whatsapp", label: "וואטסאפ" },
  { key: "sms", label: "SMS" },
  { key: "email", label: "אימייל" },
];

export function SendCampaignModal({
  segment,
  onClose,
}: {
  segment: string;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("whatsapp");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(SUGGESTED_BODY[segment] ?? "");
  const [preview, setPreview] = useState<{ recipients: number; remaining: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setPreview(null);
      try {
        const r = await fetch(
          `/api/v1/merchant/growth/campaign?segment=${encodeURIComponent(segment)}&channel=${channel}`,
        );
        const d = r.ok ? await r.json() : null;
        if (active && d) setPreview({ recipients: d.recipients, remaining: d.remaining ?? null });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [segment, channel]);

  async function send() {
    if (!body.trim()) {
      setError("צריך תוכן להודעה");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/merchant/growth/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment,
        channel,
        subject: channel === "email" ? subject : undefined,
        body: body.trim(),
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError("השליחה נכשלה. נסו שוב.");
      return;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error?.message ?? "השליחה נכשלה.");
      return;
    }
    setResult({ sent: data.sent, total: data.total });
  }

  return (
    <Modal open onClose={onClose} size="md" ariaLabel="שליחת קמפיין">
      <ModalHeader
        title="שליחת קמפיין"
        subtitle={`לסגמנט: ${SEGMENT_LABELS[segment] ?? segment}`}
        onClose={onClose}
      />
      <ModalBody>
        {result ? (
          <div className="text-center py-6">
            <div className="text-3xl font-black text-qf-ink">{result.sent}</div>
            <div className="text-sm text-qf-ink2 mt-1">הודעות נשלחו מתוך {result.total} נמענים</div>
          </div>
        ) : (
          <>
            <label className="block text-sm font-semibold text-qf-ink mb-1">ערוץ</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChannel(c.key)}
                  className={`text-sm rounded-2xl border px-3 py-2.5 transition ${
                    channel === c.key
                      ? "border-(--qf-primary) bg-(--qf-primary)/10 font-semibold"
                      : "border-qf-line bg-white"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mt-3 text-xs text-qf-ink2 bg-qf-bg rounded-xl px-3 py-2">
              {preview === null
                ? "בודק כמה נמענים..."
                : `${preview.recipients} נמענים שאישרו דיוור` +
                  (preview.remaining !== null ? ` · יתרה: ${preview.remaining}` : "")}
            </div>

            {channel === "email" && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-qf-ink mb-1">נושא</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="נושא המייל"
                  className="w-full bg-qf-bg border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary) focus:bg-white"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-semibold text-qf-ink mb-1">תוכן ההודעה</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full bg-qf-bg border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary) focus:bg-white resize-none"
              />
            </div>

            {error && <div className="mt-3 text-sm text-qf-tomato">{error}</div>}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {result ? (
          <button onClick={onClose} className="rounded-2xl bg-black text-white px-5 py-2.5 text-sm font-bold">
            סגירה
          </button>
        ) : (
          <>
            <button
              onClick={onClose}
              className="rounded-2xl border border-qf-line px-4 py-2.5 text-sm font-semibold text-qf-ink2"
            >
              ביטול
            </button>
            <button
              onClick={send}
              disabled={busy || (preview !== null && preview.recipients === 0)}
              className="rounded-2xl bg-black text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {busy ? "שולח..." : "שליחה עכשיו"}
            </button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
