"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

const SEEN_KEY = "qf:bottom-cta:seen";

export default function BottomCtaPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return;

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const full = document.documentElement.scrollHeight;
      if (scrolled >= full - 120) {
        sessionStorage.setItem(SEEN_KEY, "1");
        setOpen(true);
        window.removeEventListener("scroll", onScroll);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!open) return null;

  return (
    <div
      className={styles.bottomCtaOverlay}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.bottomCtaCard} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.bottomCtaClose}
          onClick={() => setOpen(false)}
          aria-label="סגור"
        >
          ✕
        </button>

        <h2 className={styles.bottomCtaTitle}>
          אכלנו לך
          <br />
          <mark>את הראש</mark>?!
        </h2>

        <p className={styles.bottomCtaText}>
          תשמע, במילים פשוטות - המוצר שלנו <strong>פצצה</strong>. המחיר נמוך,
          העמלה מאוד נמוכה, ואין לך מה להפסיד. אז למה לא לנסות?
        </p>
        <p className={styles.bottomCtaSub}>ללא התחייבות כמובן.</p>

        <Link
          href="/signup"
          className={styles.bottomCtaBtn}
          onClick={() => setOpen(false)}
        >
          הרשמה לניסיון 7 ימים ללא עלות
        </Link>
      </div>
    </div>
  );
}
