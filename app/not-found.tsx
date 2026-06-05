import type { Metadata } from "next";
import Link from "next/link";
import { Rubik } from "next/font/google";
import { Home, MessageCircle, LayoutDashboard, ArrowRight, Search } from "lucide-react";
import styles from "./not-found.module.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "404 - הדף לא נמצא",
  description:
    "הדף שחיפשת לא קיים, אבל החנות שלך עוד יכולה לקום ב-5 דקות. חזור לדף הבית או דבר איתנו.",
  robots: { index: false, follow: false },
};

// Never let Vercel's CDN cache a 404 response - a single 404 on a custom
// domain during the brief window after the merchant points their DNS but
// before the proxy starts routing them would otherwise stick at the edge
// for the better part of an hour, making the storefront look broken.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NotFound() {
  return (
    <div className={`${styles.root} ${rubik.variable}`}>
      <nav className={styles.nav} aria-label="ראשי">
        <Link href="/" className={styles.brand} aria-label="QuickFood - דף הבית">
          <img
            src="/quickfood-mark-white.png"
            alt="QuickFood"
            width={48}
            height={48}
            className={styles.brandImg}
          />
        </Link>
        <Link href="/" className={styles.navLink}>
          <ArrowRight size={14} strokeWidth={2.6} aria-hidden />
          חזרה לדף הבית
        </Link>
      </nav>

      <main className={styles.main}>
        <div className={styles.stage}>
          <span className={styles.eyebrow}>
            <strong>אופס</strong>
            הכתובת לא נמצאה בתפריט
          </span>

          <div className={styles.numberRow} aria-label="404">
            <span className={styles.digit} aria-hidden>
              4
            </span>
            <span className={styles.pizza} aria-hidden>
              <PizzaZero />
            </span>
            <span className={styles.digit} aria-hidden>
              4
            </span>
          </div>

          <h1 className={styles.headline}>
            המנה הזו <em>יצאה מהתפריט.</em>
          </h1>

          <p className={styles.lede}>
            הקישור שניסית לפתוח לא קיים אצלנו - אולי הפריט הוסר, הכתובת השתנתה,
            או שמישהו ערבל את האותיות. החנות שלך עדיין שם, ואנחנו ב-5 שניות
            ממך.
          </p>

          <div className={styles.ctaRow}>
            <Link href="/" className={`${styles.btn} ${styles.btnPrimary}`}>
              <ArrowRight size={14} strokeWidth={2.6} aria-hidden />
              חזרה לדף הבית
            </Link>
            <Link href="/contact" className={`${styles.btn} ${styles.btnGhost}`}>
              <MessageCircle size={15} strokeWidth={2.4} aria-hidden />
              דברו איתנו
            </Link>
          </div>

          <div className={styles.shortcuts}>
            <Link href="/signup" className={styles.shortcut}>
              <Home size={18} strokeWidth={2.2} aria-hidden />
              <span className={styles.shortcutLabel}>חדש כאן?</span>
              <span className={styles.shortcutTitle}>פתחו לי חנות</span>
            </Link>
            <Link href="/dashboard/login" className={styles.shortcut}>
              <LayoutDashboard size={18} strokeWidth={2.2} aria-hidden />
              <span className={styles.shortcutLabel}>כבר רשום?</span>
              <span className={styles.shortcutTitle}>כניסה לדשבורד</span>
            </Link>
            <Link href="/#features" className={styles.shortcut}>
              <Search size={18} strokeWidth={2.2} aria-hidden />
              <span className={styles.shortcutLabel}>סקרן?</span>
              <span className={styles.shortcutTitle}>מה יש בפנים</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <span>QuickFood · 404</span>
        <Link href="/status">סטטוס מערכת</Link>
      </footer>
    </div>
  );
}

/* The pizza-pie "0" - a circle with a wedge missing on the upper-right.
   Two simple paths so it scales crisply at every size, plus a few
   pepperoni dots so it actually reads as a pizza and not a donut. */
function PizzaZero() {
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-hidden
    >
      {/* Crust outline - a full disc with a pie-wedge subtracted via path
          composition. The wedge spans from 12 o'clock to ~4 o'clock. */}
      <defs>
        <clipPath id="pieMask">
          {/* Pie with wedge cut out. Sweep flag chosen so the cut faces
              outward - gives the "missing slice" look rather than a
              Pac-Man mouth. */}
          <path d="
            M 100 100
            L 100 0
            A 100 100 0 1 1 50 186.6
            Z
          " />
        </clipPath>
      </defs>

      {/* Cheese layer - soft yellow, sits under the crust. */}
      <g clipPath="url(#pieMask)">
        <circle cx="100" cy="100" r="86" fill="#FFE99A" />
        {/* Pepperoni - 5 tomato discs scattered on the cheese */}
        <circle cx="70" cy="70" r="11" fill="#E04A2B" />
        <circle cx="125" cy="80" r="9" fill="#E04A2B" />
        <circle cx="65" cy="125" r="10" fill="#E04A2B" />
        <circle cx="120" cy="130" r="12" fill="#E04A2B" />
        <circle cx="92" cy="155" r="8" fill="#E04A2B" />
        {/* Tiny basil specks for character */}
        <circle cx="95" cy="100" r="3" fill="#2A6B3F" />
        <circle cx="140" cy="105" r="2.5" fill="#2A6B3F" />
        <circle cx="55" cy="95" r="2" fill="#2A6B3F" />
        <circle cx="85" cy="130" r="2.5" fill="#2A6B3F" />
      </g>

      {/* Crust ring - thick black stroke. Two arcs: the main arc, then
          the two straight cut edges of the missing slice. */}
      <path
        d="M 100 8
           A 92 92 0 1 1 53.5 180.8"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* The two straight edges of the missing wedge - short black lines
          that meet at the center, forming the cut. */}
      <path
        d="M 100 8 L 100 100 L 53.5 180.8"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="14"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
