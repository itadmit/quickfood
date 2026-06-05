"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import {
  IcoEye,
  IcoCopy,
  IcoCheck,
  IcoWhatsApp,
  IcoQrCode,
  IcoShare,
  IcoClose,
} from "@/components/shared/Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  tenantName: string;
  tenantSlug: string;
  storefrontUrl: string;
  qrDataUrl: string;
}

export function ShopShareModal({
  open,
  onClose,
  tenantName,
  tenantSlug,
  storefrontUrl,
  qrDataUrl,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  function shareWhatsApp() {
    const text = `${tenantName} — להזמנות אונליין: ${storefrontUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !("share" in navigator)) return;
    try {
      await navigator.share({
        title: tenantName,
        text: `${tenantName} — להזמנות אונליין`,
        url: storefrontUrl,
      });
    } catch {
      /* user dismissed */
    }
  }

  const hasNativeShare = typeof navigator !== "undefined" && "share" in navigator;
  const downloadName = `${tenantSlug || "quickfood"}-qr.png`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      ariaLabel="שיתוף החנות"
      panelStyle={{ backgroundColor: "#F8CB1E" }}
      className="overflow-hidden border-2 border-black shadow-[0_6px_0_#000]"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="סגור"
        className="absolute top-4 inset-s-4 z-20 w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center text-black transition active:scale-95"
      >
        <IcoClose c="currentColor" s={18} />
      </button>

      <div className="relative flex-1 min-h-0 overflow-y-auto px-5 py-7 md:px-8 md:py-9">
        <div className="mb-4 inline-flex items-center gap-2 text-black/70 text-xs font-semibold">
          <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
            QuickFood
          </span>
          <span>שיתוף החנות</span>
        </div>

        <h2 className="text-black font-black text-2xl md:text-3xl leading-[1.05] mb-5">
          <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block">
            שתף
          </span>{" "}
          את החנות שלך
        </h2>

        <div className="bg-white border-2 border-black rounded-2xl px-3 py-2.5 text-xs break-all text-black/70 mb-4 font-mono" dir="ltr">
          {storefrontUrl}
        </div>

        <a
          href={`/s/${tenantSlug}`}
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
          className="group flex items-center gap-3 w-full bg-white border-4 border-black rounded-2xl px-4 py-4 shadow-[0_4px_0_#000] hover:shadow-[0_6px_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_#000] transition mb-3"
        >
          <span className="w-11 h-11 grid place-items-center rounded-xl bg-[#F8CB1E] border-2 border-black shrink-0">
            <IcoEye c="#000" s={20} />
          </span>
          <span className="flex-1 text-start">
            <div className="font-black text-black text-base md:text-lg">צפה בחנות</div>
            <div className="text-xs text-black/65 mt-0.5">פתיחה בטאב חדש</div>
          </span>
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <ActionCard
            onClick={copy}
            title={copied ? "הועתק!" : "העתק כתובת"}
            body="שלח את הלינק היכן שתרצה"
            icon={
              copied
                ? <IcoCheck c="#0a6b3c" s={20} />
                : <IcoCopy c="#000" s={20} />
            }
            iconBg={copied ? "#bff5d6" : "#FFF2C9"}
          />

          <ActionCard
            onClick={shareWhatsApp}
            title="שתף בוואטסאפ"
            body="פתח שיחה עם הקישור"
            icon={<IcoWhatsApp s={22} />}
            iconBg="#dcf8c6"
          />

          <ActionCard
            onClick={() => setShowQr((v) => !v)}
            title="קוד QR"
            body="להדפסה על תפריטים ושלטים"
            icon={<IcoQrCode c="#000" s={22} />}
            iconBg="#FFF2C9"
          />

          {hasNativeShare && (
            <ActionCard
              onClick={nativeShare}
              title="שתף דרך…"
              body="חלון השיתוף של המכשיר"
              icon={<IcoShare c="#000" s={20} />}
              iconBg="#FFF2C9"
            />
          )}
        </div>

        {showQr && (
          <div className="mt-4 bg-white border-2 border-black rounded-2xl p-4 shadow-[0_3px_0_#000]">
            <div className="grid place-items-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR code לחנות ${tenantName}`}
                width={260}
                height={260}
                className="w-full max-w-[260px] h-auto"
              />
            </div>
            <a
              href={qrDataUrl}
              download={downloadName}
              className="block w-full text-center px-3 py-2.5 rounded-xl bg-black hover:bg-black/90 text-[#F8CB1E] text-sm font-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
            >
              הורד PNG
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ActionCard({
  onClick,
  title,
  body,
  icon,
  iconBg,
}: {
  onClick: () => void;
  title: string;
  body: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 bg-white border-2 border-black rounded-2xl px-3 py-3 text-start shadow-[0_3px_0_#000] hover:shadow-[0_5px_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_#000] transition"
    >
      <span
        className="w-10 h-10 grid place-items-center rounded-xl border-2 border-black shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <div className="font-black text-black text-sm truncate">{title}</div>
        <div className="text-[11px] text-black/60 mt-0.5 truncate">{body}</div>
      </span>
    </button>
  );
}
