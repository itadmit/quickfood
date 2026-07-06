"use client";

import { useState } from "react";
import { IcoWhatsApp } from "@/components/shared/Icons";
import { Modal, ModalBody } from "@/components/shared/Modal";
import { WA_IMPORT_MESSAGE, WA_IMPORT_PHONE } from "@/lib/wa-import";

// Mounted only for tenants with signupImportMethod === "whatsapp" and an
// empty menu - so it reappears on every dashboard visit (any device) until
// the items are actually in.
export function WhatsAppImportModal() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <Modal open onClose={() => setOpen(false)} size="md" ariaLabel="הזנת תפריט בוואטסאפ">
      <ModalBody>
        <div className="text-center space-y-4 py-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#25D366] grid place-items-center">
            <IcoWhatsApp c="#fff" s={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black">תודה שבחרת להשתמש בייבוא מוואטסאפ</h2>
            <p className="text-sm text-qf-ink2 leading-relaxed">
              יש לשלוח את כל המידע האפשרי, כמה שיותר מסודר ובפורמט קבוע:
              שם המנה, קטגוריה, מחיר, תוספות אפשריות - ואז תמונה של המנה.
            </p>
            <div className="rounded-xl bg-qf-line-soft px-3 py-2.5 text-sm text-qf-ink2 leading-relaxed text-start">
              <span className="font-semibold text-qf-ink">למשל:</span> פיצה
              נפוליטנה, פיצות, 59₪, זיתים, טונה, תירס, פטריות, בולגרית
              <br />
              ומיד אחרי - תמונה של המנה.
            </div>
          </div>
          <a
            href={`https://wa.me/${WA_IMPORT_PHONE}?text=${encodeURIComponent(WA_IMPORT_MESSAGE)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-3 rounded-xl bg-[#25D366] hover:brightness-105 text-white text-sm font-black inline-flex items-center justify-center gap-2 transition"
          >
            <IcoWhatsApp c="#fff" s={18} />
            לחצו כאן לשליחת התפריט
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-qf-mute hover:text-qf-ink hover:bg-qf-line-soft transition"
          >
            אשלח אחר כך
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
