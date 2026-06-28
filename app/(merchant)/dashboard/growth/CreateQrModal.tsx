"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/shared/Modal";

// Mirror of lib/growth/qr type/destination labels (kept inline so this
// client component doesn't import the server-only qr module).
const QR_TYPES: { key: string; label: string }[] = [
  { key: "bag", label: "מדבקה לשקית משלוח" },
  { key: "sticker", label: "מדבקה לאריזה" },
  { key: "table_tent", label: "שלט שולחן" },
  { key: "flyer", label: "פלייר" },
  { key: "receipt", label: "QR על הקבלה" },
  { key: "ig_bio", label: "קישור באינסטגרם" },
  { key: "gbp", label: "פרופיל עסק בגוגל" },
  { key: "poster", label: "פוסטר בחנות" },
];

const DESTINATIONS: { key: string; label: string }[] = [
  { key: "menu", label: "ישר לתפריט ההזמנות" },
  { key: "signup", label: "הרשמה / כניסה" },
  { key: "loyalty", label: "הצטרפות למועדון" },
  { key: "landing", label: "דף נחיתה ממוקד (לפני התפריט)" },
];

const LANDING_TEMPLATES: { key: string; label: string }[] = [
  { key: "bag_insert", label: "מדבקה לשקית משלוח" },
  { key: "receipt_vip", label: "QR על הקבלה - מועדון" },
  { key: "marketplace_convert", label: "המרת לקוח מאפליקציה" },
  { key: "walk_in", label: "לקוח מזדמן בחנות" },
  { key: "first_direct_order", label: "הזמנה ישירה ראשונה" },
  { key: "birthday", label: "יום הולדת" },
  { key: "referral", label: "חבר מביא חבר" },
  { key: "cashback", label: "צ׳אקבק / החזר כספי" },
  { key: "vip", label: "לקוח VIP" },
  { key: "delivery_box", label: "מדבקה לארגז משלוח" },
  { key: "takeaway", label: "טייק אווי" },
  { key: "google_business", label: "פרופיל עסק בגוגל" },
  { key: "instagram_story", label: "סטורי באינסטגרם" },
  { key: "tiktok", label: "טיקטוק" },
  { key: "whatsapp", label: "וואטסאפ" },
  { key: "email", label: "אימייל" },
  { key: "dine_in", label: "ישיבה במקום" },
  { key: "review_request", label: "בקשת ביקורת" },
];

export function CreateQrModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("bag");
  const [destinationType, setDestinationType] = useState("menu");
  const [landingTemplate, setLandingTemplate] = useState("bag_insert");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("צריך שם לקמפיין");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/merchant/growth/qr-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        destinationType,
        landingTemplate: destinationType === "landing" ? landingTemplate : undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setError("יצירת הקמפיין נכשלה. נסו שוב.");
      return;
    }
    onCreated();
  }

  return (
    <Modal open onClose={onClose} size="md" ariaLabel="קמפיין QR חדש">
      <ModalHeader title="קמפיין QR חדש" subtitle="קוד למעקב שהופך לקוחות ללקוחות ישירים" onClose={onClose} />
      <ModalBody>
        <label className="block text-sm font-semibold text-qf-ink mb-1">שם הקמפיין</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="למשל: QR לשקיות משלוח"
          className="w-full bg-qf-bg border border-qf-line rounded-2xl px-4 py-3 text-base outline-none focus:border-(--qf-primary) focus:bg-white transition"
        />

        <label className="block text-sm font-semibold text-qf-ink mb-1 mt-4">סוג</label>
        <div className="grid grid-cols-2 gap-2">
          {QR_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`text-sm rounded-2xl border px-3 py-2.5 text-right transition ${
                type === t.key
                  ? "border-(--qf-primary) bg-(--qf-primary)/10 font-semibold"
                  : "border-qf-line bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold text-qf-ink mb-1 mt-4">לאן הקוד מוביל</label>
        <div className="space-y-2">
          {DESTINATIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDestinationType(d.key)}
              className={`w-full text-sm rounded-2xl border px-4 py-2.5 text-right transition ${
                destinationType === d.key
                  ? "border-(--qf-primary) bg-(--qf-primary)/10 font-semibold"
                  : "border-qf-line bg-white"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {destinationType === "landing" && (
          <>
            <label className="block text-sm font-semibold text-qf-ink mb-1 mt-4">תבנית דף הנחיתה</label>
            <div className="grid grid-cols-2 gap-2">
              {LANDING_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setLandingTemplate(t.key)}
                  className={`text-sm rounded-2xl border px-3 py-2.5 text-right transition ${
                    landingTemplate === t.key
                      ? "border-(--qf-primary) bg-(--qf-primary)/10 font-semibold"
                      : "border-qf-line bg-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <div className="mt-3 text-sm text-qf-tomato">{error}</div>}
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="rounded-2xl border border-qf-line px-4 py-2.5 text-sm font-semibold text-qf-ink2"
        >
          ביטול
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-2xl bg-black text-white px-5 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {busy ? "יוצר..." : "צרו קמפיין"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
