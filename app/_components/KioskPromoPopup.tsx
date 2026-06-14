"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "../page.module.css";

const DISMISS_KEY = "qf:kiosk-promo:dismissed";

export default function KioskPromoPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);

  function close() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className={styles.kioskPopOverlay} onClick={close} role="dialog" aria-modal="true">
      <div className={styles.kioskPop} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.kioskPopClose} onClick={close} aria-label="סגור">
          ✕
        </button>
        <div className={styles.kioskPopHead}>
          <Image
            src="/img/kiosk.png"
            alt="עמדת קיוסק QuickFood"
            width={105}
            height={150}
            className={styles.kioskPopImg}
          />
          <span className={styles.kioskPopBadge}>חדש</span>
          <h2 className={styles.kioskPopTitle}>
            עמדת קיוסק מתנה
            <br />
            ללא עלות ל-3 חודשים
          </h2>
        </div>
        <div className={styles.kioskPopBody}>
          <p className={styles.kioskPopText}>
            הלקוחות מזמינים ומשלמים לבד מהמסך - בלי תור, בלי טעויות. רץ על כל
            טאבלט, מסונכרן עם התפריט והדשבורד שלכם. נסו 3 חודשים על חשבוננו.
          </p>
          <div className={styles.kioskPopActions}>
            <a href="#talk" className={styles.kioskPopCta} onClick={close}>
              אני רוצה לשמוע עוד
            </a>
            <button type="button" className={styles.kioskPopDismiss} onClick={close}>
              אולי אחר כך
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
