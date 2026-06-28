"use client";

import { useEffect, useState } from "react";
import { Check, Rocket, TrendingUp, X } from "lucide-react";
import styles from "../page.module.css";

const FEATURES = [
  "מועדון לקוחות",
  "קמפייני QR",
  "תובנות AI",
  "קמפיינים ב-WhatsApp, SMS ומייל",
  "מעקב אחר מקורות הלקוחות",
];

export default function GrowthPromoPopup() {
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
          <X size={16} strokeWidth={2.4} aria-hidden />
        </button>

        <div className={`${styles.kioskPopVisual} ${styles.growthPopVisual}`} aria-hidden>
          <div className={styles.growthPopEmblem}>
            <div className={styles.growthPopEmblemIcon}>
              <TrendingUp strokeWidth={2.4} size={40} />
            </div>
            <div className={styles.growthPopEmblemName}>QuickFood Boost</div>
            <div className={styles.growthPopEmblemTag}>מערכת הצמיחה למסעדות</div>
          </div>
        </div>

        <div className={styles.kioskPopContent}>
          <span className={styles.kioskPopBadge}>חדש</span>
          <h2 className={styles.kioskPopTitle}>
            עדיין משלם עמלה
            <br />
            גם על לקוח שמכיר אותך?
          </h2>
          <p className={styles.kioskPopText}>
            QuickFood Boost עוזרת להחזיר לקוחות להזמין ישירות מהאתר שלך - במקום
            לשלם שוב ושוב עמלה על כל הזמנה חוזרת.
          </p>

          <ul className={styles.growthPopList}>
            {FEATURES.map((f) => (
              <li key={f}>
                <Check className={styles.growthPopCheck} size={17} strokeWidth={2.6} aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className={styles.kioskPopActions}>
            <a href="#growth" className={styles.kioskPopCta} onClick={close}>
              <Rocket size={17} strokeWidth={2.2} aria-hidden />
              הפעל את Boost
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
