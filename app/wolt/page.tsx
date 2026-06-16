import type { Metadata } from "next";
import Link from "next/link";
import { Rubik, JetBrains_Mono } from "next/font/google";
import { IcoArrowLeft } from "@/components/shared/Icons";
import { LeadForm } from "@/components/marketing/LeadForm";
import { WhatsAppFAB } from "../_components/WhatsAppFAB";
import ScrollAnimations from "../_components/ScrollAnimations";
import {
  LayoutGrid,
  MonitorSmartphone,
  RefreshCw,
  ChefHat,
  BarChart3,
  Store,
  Plug,
  Bell,
  Layers,
  type LucideIcon,
} from "lucide-react";
import styles from "../page.module.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-rubik",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuickFood + Wolt - כל ההזמנות במסך אחד | אינטגרציה רשמית עם Wolt",
  description:
    "QuickFood מאחדת את ההזמנות מוולט, מהאתר שלך ומכל ערוץ אחר למסך ניהול אחד ולמסך מטבח אחד. הזמנת וולט נכנסת ישר לקאנבן שלך, אתה מאשר - והסטטוס חוזר לוולט אוטומטית. סוף לקפיצה בין טאבלטים.",
  keywords: [
    "אינטגרציה עם וולט",
    "ניהול הזמנות וולט",
    "וולט במסך אחד",
    "איחוד הזמנות משלוחים",
    "מסך מטבח וולט",
    "Wolt integration",
    "Wolt orders aggregator",
    "QuickFood Wolt",
    "קוויקפוד וולט",
  ],
  alternates: { canonical: "https://quickfood.co.il/wolt" },
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "https://quickfood.co.il/wolt",
    siteName: "QuickFood",
    title: "QuickFood + Wolt - כל ההזמנות במסך אחד",
    description:
      "הזמנות וולט נכנסות ישר לקאנבן ולמסך המטבח שלך, לצד ההזמנות מהאתר שלך. אתה מאשר - והסטטוס חוזר לוולט. מסך אחד לכל הערוצים.",
  },
};

/* ─── small primitives, mirrored from the home page design system ─── */
function Nav() {
  return (
    <nav className={styles.nav}>
      <div className={`${styles.container} ${styles.navRow}`}>
        <Link href="/" className={styles.brand} aria-label="QuickFood">
          <img src="/quickfood-mark-white.png" alt="QuickFood" width={48} height={48} className={styles.brandImg} />
        </Link>
        <div className={styles.navCta}>
          <Link href="/" className={`${styles.btn} ${styles.btnGhost}`}>
            לאתר הראשי
          </Link>
          <a href="#join" className={`${styles.btn} ${styles.btnInk}`}>
            הצטרפו ראשונים
          </a>
        </div>
      </div>
    </nav>
  );
}

function StepCard({ n, Icon, title, body }: { n: string; Icon: LucideIcon; title: string; body: string }) {
  return (
    <article className={`${styles.qfoodCard} ${styles.qfoodCardMist} ${styles.qfoodCardDecorEnd}`}>
      <div className={styles.qfoodCardDecor} aria-hidden>
        <Icon strokeWidth={2} />
      </div>
      <div className={styles.qfoodCardBody}>
        <div className={styles.qfoodCardTag}>שלב {n}</div>
        <h3 className={styles.qfoodCardHeading}>{title}</h3>
        <p className={styles.qfoodCardCopy}>{body}</p>
      </div>
    </article>
  );
}

type Tone = "mist" | "sand" | "peach" | "lilac";
function FeatureCard({
  tone,
  layout = "decor-end",
  Icon,
  tag,
  heading,
  body,
}: {
  tone: Tone;
  layout?: "decor-end" | "decor-start";
  Icon: LucideIcon;
  tag: string;
  heading: string;
  body: string;
}) {
  const toneClass = {
    mist: styles.qfoodCardMist,
    sand: styles.qfoodCardSand,
    peach: styles.qfoodCardPeach,
    lilac: styles.qfoodCardLilac,
  }[tone];
  const layoutClass =
    layout === "decor-start" ? styles.qfoodCardDecorStart : styles.qfoodCardDecorEnd;
  return (
    <article className={`${styles.qfoodCard} ${toneClass} ${layoutClass}`}>
      <div className={styles.qfoodCardDecor} aria-hidden>
        <Icon strokeWidth={2} />
      </div>
      <div className={styles.qfoodCardBody}>
        <div className={styles.qfoodCardTag}>{tag}</div>
        <h3 className={styles.qfoodCardHeading}>{heading}</h3>
        <p className={styles.qfoodCardCopy}>{body}</p>
      </div>
    </article>
  );
}

function MiniCell({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className={styles.miniCell}>
      <span className={styles.miniCellTag}>{tag}</span>
      <h4 className={styles.miniCellTitle}>{title}</h4>
      <p className={styles.miniCellBody}>{body}</p>
    </div>
  );
}

export default function WoltLandingPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${mono.variable}`}>
      <Nav />

      {/* ── HERO ── */}
      <header className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot}>בקרוב</span>
            אינטגרציה רשמית עם Wolt
          </div>
          <h1 className={styles.headline}>
            <span className={styles.stack}>הזמנות מוולט.</span>
            <span className={styles.stack}>הזמנות מהאתר שלך.</span>
            <span className={styles.stack}>
              <em>מסך אחד.</em>
            </span>
          </h1>
          <p className={styles.headlineSmall}>
            QuickFood מתחברת ישירות ל-Wolt ומושכת את ההזמנות שלך פנימה - אל אותו לוח ניהול
            ואל אותו מסך מטבח שבהם אתה כבר עובד. ההזמנה מוולט נוחתת אצלך בקליק, אתה מאשר, והסטטוס
            חוזר לוולט אוטומטית. בלי טאבלט נפרד, בלי לקפוץ בין מסכים, בלי להקליד הזמנות מחדש.
          </p>

          <div className={styles.heroCta}>
            <a href="#join" className={`${styles.btn} ${styles.btnTomato} ${styles.btnLg}`}>
              הצטרפו ראשונים
            </a>
            <a
              href="#how"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostOutline} ${styles.btnLg}`}
            >
              איך זה עובד <IcoArrowLeft c="currentColor" s={14} />
            </a>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatN}>מסך 1</div>
              <div className={styles.heroStatL}>כל הערוצים, לוח ומטבח אחד.</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatN}>זמן אמת</div>
              <div className={styles.heroStatL}>הזמנות וולט נכנסות מיד למסך.</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatN}>סנכרון</div>
              <div className={styles.heroStatL}>סטטוס חוזר לוולט אוטומטית.</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── PROBLEM ── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionEyebrow}>המצב היום</div>
          <h2 className={styles.sectionTitle}>
            טאבלט של וולט. האתר שלך. הטלפון. <em>שלושה מסכים, מטבח אחד.</em>
          </h2>
          <p className={styles.headlineSmall}>
            כל ערוץ עם המכשיר שלו, הצליל שלו וההיגיון שלו. הזמנות מתפספסות, זמני הכנה מתפזרים,
            והצוות רץ בין מסכים בשעת לחץ. לאחד את הכל למקום אחד זה לא מותרות - זה השקט של המטבח.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionEyebrow}>איך זה עובד</div>
          <h2 className={styles.sectionTitle}>
            הזמנה מוולט - <em>בלי להרים אצבע.</em>
          </h2>
          <div className={styles.qfoodStack}>
            <StepCard
              n="1"
              Icon={Plug}
              title="מחברים את וולט פעם אחת."
              body="לחיצה אחת בדשבורד מחברת את חשבון הוולט שלך ל-QuickFood. חיבור רשמי ומאובטח, בלי סיסמאות משותפות ובלי טאבלט נוסף."
            />
            <StepCard
              n="2"
              Icon={LayoutGrid}
              title="ההזמנה נכנסת ישר ללוח שלך."
              body="כל הזמנה מוולט נוחתת אוטומטית בקאנבן ובמסך המטבח - לצד ההזמנות מהאתר שלך. אותו זרם עבודה, אותם פריטים, אותו צוות."
            />
            <StepCard
              n="3"
              Icon={RefreshCw}
              title="אתה מאשר - והסטטוס חוזר לוולט."
              body="מאשר, 'בהכנה', 'מוכן' - הכל מתעדכן בוולט בזמן אמת מאותו מסך. הלקוח בוולט מקבל את העדכון, אתה לא נוגע בטאבלט."
            />
          </div>
        </div>
      </section>

      {/* ── HIGHLIGHTS ── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionEyebrow}>מה מקבלים</div>
          <h2 className={styles.sectionTitle}>
            ערוץ אחד נוסף. <em>אפס בלגן נוסף.</em>
          </h2>
          <div className={styles.qfoodStack}>
            <FeatureCard
              tone="mist"
              layout="decor-end"
              Icon={LayoutGrid}
              tag="לוח מאוחד"
              heading="כל ההזמנות בקאנבן אחד - וולט והאתר שלך יחד."
              body="הזמנות וולט מסומנות בבירור על אותו לוח שאתה כבר מכיר. בלי מסך נפרד, בלי להחליט כל פעם איפה להסתכל."
            />
            <FeatureCard
              tone="sand"
              layout="decor-start"
              Icon={ChefHat}
              tag="מסך מטבח"
              heading="המטבח רואה הכל במקום אחד."
              body="הזמנת וולט נכנסת למסך המטבח כמו כל הזמנה אחרת - אותם פריטים, אותן הערות, אותו זמן הכנה. הצוות לא לומד מערכת חדשה."
            />
            <FeatureCard
              tone="peach"
              layout="decor-end"
              Icon={Bell}
              tag="סנכרון סטטוס"
              heading="אישור ומוכן - חוזרים לוולט לבד."
              body="כשאתה מקדם הזמנה אצלנו, וולט מתעדכנת אוטומטית. בלי כפל עבודה ובלי לזכור לעדכן בשני מקומות."
            />
            <FeatureCard
              tone="lilac"
              layout="decor-start"
              Icon={Layers}
              tag="תפריט אחד"
              heading="הפריטים מתחברים לתפריט שכבר יש לך."
              body="הזמנת וולט מתחברת לפריטים הקיימים במערכת שלך, כך שדוחות, מלאי וניתוחים מדברים שפה אחת על פני כל הערוצים."
            />
            <FeatureCard
              tone="sand"
              layout="decor-end"
              Icon={BarChart3}
              tag="אנליטיקה חוצת-ערוצים"
              heading="כמה מגיע מוולט, כמה ישירות - במבט אחד."
              body="הכנסות, הזמנות ושעות שיא לכל ערוץ בנפרד ובמצטבר. סוף-סוף תמונה אחת אמיתית של העסק, לא טבלאות נפרדות."
            />
            <FeatureCard
              tone="peach"
              layout="decor-start"
              Icon={Store}
              tag="האתר שלך במרכז"
              heading="וולט מצטרף. האתר שלך נשאר הבית."
              body="הקבועים מזמינים ישירות מהאתר שלך בלי עמלת מרקטפלייס, והזמנות וולט פשוט זורמות לאותו מקום. גם וגם, בלי להתפשר."
            />
          </div>

          <div className={styles.miniGrid}>
            <MiniCell tag="התראות" title="צליל לכל הזמנה חדשה" body="הזמנת וולט מצלצלת כמו כל הזמנה - הצוות יודע מיד, בלי לבהות בטאבלט." />
            <MiniCell tag="קבלות" title="הדפסה אוטומטית למטבח" body="הזמנת וולט יוצאת למדפסת או למסך המטבח בדיוק כמו הזמנה מהאתר שלך." />
            <MiniCell tag="היסטוריה" title="הכל בהיסטוריה אחת" body="חיפוש, סינון ודוחות על כל ההזמנות - וולט והאתר - מאותו מסך." />
            <MiniCell tag="ללא הקלדה" title="סוף להקלדה ידנית" body="ההזמנה נכנסת מלאה ומדויקת - פריטים, תוספות והערות - בלי להקליד מחדש." />
            <MiniCell tag="אמין" title="חיבור רשמי ומאובטח" body="אינטגרציה רשמית מול וולט, בלי סיסמאות משותפות ובלי פתרונות עקיפים." />
            <MiniCell tag="ערוצים נוספים" title="בנוי לעוד ערוצים" body="המנוע נבנה לאחד גם ערוצי משלוח נוספים בעתיד - אותו לוח, אותו מטבח." />
          </div>
        </div>
      </section>

      {/* ── PARTNER NOT COMPETITOR ── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionEyebrow}>שותף, לא מתחרה</div>
          <h2 className={styles.sectionTitle}>
            לא לבחור בין וולט לבית. <em>פשוט לנהל את שניהם ממקום אחד.</em>
          </h2>
          <p className={styles.headlineSmall}>
            וולט מביא לך לקוחות חדשים, האתר שלך שומר את הקבועים שלך. QuickFood מחברת ביניהם
            למסך אחד - כדי שתפסיק לנהל מסכים ותתחיל לנהל מסעדה. מחברים ומתחילים לעבוד.
          </p>
        </div>
      </section>

      {/* ── JOIN ── */}
      <section className={styles.finalCta}>
        <div className={styles.container}>
          <div className={styles.finalCtaCard}>
            <div className={styles.finalCtaBody}>
              <span className={styles.finalCtaTag}>גישה מוקדמת</span>
              <h2>
                רוצה להיות מהראשונים? <em>נשמור לך מקום.</em>
              </h2>
              <p>
                אנחנו משיקים את החיבור הרשמי לוולט בקרוב. השאר פרטים ונחבר אותך ברגע שזה עולה -
                ליווי אישי בהקמה, בלי התעסקות.
              </p>
            </div>
          </div>

          <div id="join" className={styles.leadFormWrap}>
            <LeadForm
              source="wolt"
              heading="הצטרפו לגישה המוקדמת"
              subheading="השאר פרטים ונעדכן אותך ברגע שהחיבור לוולט פתוח לחנות שלך. בלי שיחת מכירה אגרסיבית."
              submitLabel="שמרו לי מקום"
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footBottom}>
            <span>© 2026 Quickshop Ltd. כל הזכויות שמורות.</span>
            <Link href="/">QuickFood</Link>
          </div>
        </div>
      </footer>

      <ScrollAnimations />
      <WhatsAppFAB />
    </div>
  );
}
