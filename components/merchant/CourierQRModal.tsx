"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/shared/Modal";

export function CourierQRModal({
  courierId,
  courierName,
  onClose,
}: {
  courierId: string;
  courierName: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ttlMinutes, setTtlMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/merchant/couriers/${courierId}/magic-link`, {
          method: "POST",
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message ?? "יצירת קישור נכשלה");
          return;
        }
        const data = await res.json();
        setUrl(data.url);
        setTtlMinutes(data.ttl_minutes ?? 60);
        const qr = await QRCode.toDataURL(data.url, {
          width: 480,
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setQrDataUrl(qr);
      } catch {
        if (!cancelled) setError("בעיית רשת");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courierId]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal open onClose={onClose} size="sm" ariaLabel="התחברות מהירה לשליח">
      <div className="p-5 space-y-4">
        <header className="text-center">
          <h3 className="font-bold text-lg">התחברות מהירה</h3>
          <p className="text-sm text-qf-mute">
            {courierName} סורק/ת את הקוד בטלפון ונכנס/ת אוטומטית
          </p>
        </header>

        <div className="aspect-square bg-qf-line-soft rounded-xl grid place-items-center overflow-hidden">
          {error ? (
            <p className="text-qf-tomato text-sm p-4 text-center">{error}</p>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR התחברות" className="w-full h-full" />
          ) : (
            <p className="text-qf-mute text-sm">יוצר קוד...</p>
          )}
        </div>

        {url && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] text-qf-mute">
                {ttlMinutes != null && `הקוד תקף ${ttlMinutes} דקות. `}אפשר גם להעתיק
                ולשלוח ב-WhatsApp:
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  dir="ltr"
                  className="flex-1 px-3 py-2 rounded-lg border border-qf-line-dash text-xs font-mono bg-qf-line-soft truncate"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-3 py-2 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xs font-medium whitespace-nowrap"
                >
                  {copied ? "הועתק!" : "העתקה"}
                </button>
              </div>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`קישור התחברות לאפליקציית השליחים: ${url}`)}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2.5 rounded-xl bg-[#25D366] text-white text-center text-sm font-medium"
            >
              שיתוף ב-WhatsApp
            </a>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-qf-line-dash text-sm"
        >
          סגירה
        </button>
      </div>
    </Modal>
  );
}
