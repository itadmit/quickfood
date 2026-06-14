"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "../page.module.css";

export default function KioskPromoPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);

  function close() {
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className={styles.kioskPopOverlay} onClick={close} role="dialog" aria-modal="true">
      <div className={styles.kioskPop} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.kioskPopClose} onClick={close} aria-label="סגור">
          ✕
        </button>

        <div className={styles.kioskPopVisual}>
          <Image
            src="/img/kiosk.png"
            alt="עמדת קיוסק QuickFood"
            width={280}
            height={400}
            className={styles.kioskPopImg}
          />
        </div>

        <div className={styles.kioskPopContent}>
          <span className={styles.kioskPopBadge}>חדש</span>
          <h2 className={styles.kioskPopTitle}>
            עמדת קיוסק מתנה
            <br />
            ללא עלות ל-3 חודשים
          </h2>
          <p className={styles.kioskPopText}>
            הלקוחות מזמינים ומשלמים לבד מהמסך - בלי תור, בלי טעויות. רץ על כל
            טאבלט, מסונכרן עם התפריט והדשבורד שלכם.
          </p>
          <div className={styles.kioskPopActions}>
            <a href="#kiosk" className={styles.kioskPopCta} onClick={close}>
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
