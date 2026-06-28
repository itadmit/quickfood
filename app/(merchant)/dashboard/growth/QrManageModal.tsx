"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/shared/Modal";
import { IcoCopy } from "@/components/shared/Icons";

export interface ManagedCampaign {
  id: string;
  name: string;
  code: string;
  status: string;
}

// View/manage an EXISTING QR campaign: re-show the QR + tracked link, pause or
// resume it, or delete it. Reuses the merchant QR PATCH/DELETE endpoints.
export function QrManageModal({
  campaign,
  slug,
  onClose,
  onChanged,
}: {
  campaign: ManagedCampaign;
  slug: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${slug}/q/${campaign.code}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const paused = campaign.status !== "active";

  useEffect(() => {
    let on = true;
    QRCode.toDataURL(url, { width: 320, margin: 2 })
      .then((d) => on && setQr(d))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [url]);

  async function setStatus(status: "active" | "paused") {
    setBusy(true);
    await fetch(`/api/v1/merchant/growth/qr-campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/v1/merchant/growth/qr-campaigns/${campaign.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    onChanged();
  }

  return (
    <Modal open onClose={onClose} size="md" ariaLabel={campaign.name}>
      <ModalHeader title={campaign.name} subtitle={paused ? "מושהה" : "פעיל"} onClose={onClose} />
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR" className="w-44 h-44 rounded-2xl border border-qf-line" />
          )}
          <div className="mt-4 w-full">
            <div className="text-xs font-semibold text-qf-ink2 mb-1">קישור המעקב</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                dir="ltr"
                className="flex-1 min-w-0 bg-qf-bg border border-qf-line rounded-xl px-3 py-2 text-xs outline-none text-qf-ink2 text-left"
              />
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }, () => {});
                }}
                className="shrink-0 inline-flex items-center gap-1 bg-black text-white text-xs font-bold rounded-xl px-3 py-2"
              >
                <IcoCopy s={14} /> {copied ? "הועתק" : "העתק"}
              </button>
            </div>
          </div>

          {confirmDelete && (
            <div className="mt-4 w-full rounded-2xl border border-qf-tomato/40 bg-qf-tomato-soft p-3 text-sm text-qf-tomato">
              למחוק את הקמפיין? הנתונים שנאספו יימחקו. פעולה לא הפיכה.
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {qr && (
          <a
            href={qr}
            download={`qr-${campaign.code}.png`}
            className="rounded-2xl border border-qf-line px-4 py-2.5 text-sm font-semibold text-qf-ink"
          >
            הורדת PNG
          </a>
        )}
        {confirmDelete ? (
          <>
            <button onClick={() => setConfirmDelete(false)} className="rounded-2xl border border-qf-line px-4 py-2.5 text-sm font-semibold text-qf-ink2">
              ביטול
            </button>
            <button onClick={remove} disabled={busy} className="rounded-2xl bg-qf-tomato text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              כן, מחק
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="rounded-2xl border border-qf-tomato/50 text-qf-tomato px-4 py-2.5 text-sm font-semibold">
              מחיקה
            </button>
            <button onClick={() => setStatus(paused ? "active" : "paused")} disabled={busy} className="rounded-2xl bg-black text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              {paused ? "הפעלה מחדש" : "השהיה"}
            </button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
