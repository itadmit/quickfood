"use client";

import { useEffect, useState } from "react";
import { IcoWhatsApp } from "@/components/shared/Icons";
import { Modal, ModalBody } from "@/components/shared/Modal";
import { WA_IMPORT_FLAG, WA_IMPORT_MESSAGE, WA_IMPORT_PHONE } from "@/lib/wa-import";

export function WhatsAppImportModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(WA_IMPORT_FLAG) === "1") setOpen(true);
    } catch {}
  }, []);

  function dismiss() {
    try {
      localStorage.removeItem(WA_IMPORT_FLAG);
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <Modal open onClose={dismiss} size="md" ariaLabel="הזנת תפריט בוואטסאפ">
      <ModalBody>
        <div className="text-center space-y-4 py-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#25D366] grid place-items-center">
            <IcoWhatsApp c="#fff" s={28} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black">בחרתם בייבוא דרך וואטסאפ</h2>
            <p className="text-sm text-qf-ink2 leading-relaxed">
              שלחו לנו את התפריט - קובץ, צילום או תמונה נפרדת לכל מנה עם שם,
              מחיר ותוספות - והצוות של QuickFood יזין לכם את הכל לחנות.
            </p>
          </div>
          <a
            href={`https://wa.me/${WA_IMPORT_PHONE}?text=${encodeURIComponent(WA_IMPORT_MESSAGE)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="w-full px-4 py-3 rounded-xl bg-[#25D366] hover:brightness-105 text-white text-sm font-black inline-flex items-center justify-center gap-2 transition"
          >
            <IcoWhatsApp c="#fff" s={18} />
            לחצו כאן לשליחת התפריט
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-qf-mute hover:text-qf-ink hover:bg-qf-line-soft transition"
          >
            אשלח אחר כך
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
