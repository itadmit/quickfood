import type { Metadata } from "next";
import Image from "next/image";
import { Rubik, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { IcoArrowLeft } from "@/components/shared/Icons";
import Typewriter from "./_components/Typewriter";
import VerticalRotator from "./_components/VerticalRotator";
import FeatureIcon, { type IconName } from "./_components/FeatureIcon";
import ItemCustomizerMockup from "./_components/ItemCustomizerMockup";
import styles from "./page.module.css";

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
  title: "QuickFood - חנות אונליין שנולדה למזון",
  description:
    "פיצרייה, המבורגרייה, סושייה או שווארמייה - תוספות, גדלים, סוג בצק, רטבי-צד, הערות לטבח. תפריט בשפה של המטבח, דשבורד בקצב של משמרת. ₪299 לחודש + 0.5% להזמנה.",
};

export default function LandingPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${mono.variable}`}>
      <FaqSchema />
      <Nav />
      <Hero />
      <TrustStrip />
      <SuitedFor />
      <HowItWorks />
      <Math />
      <Features />
      <GrowPartner />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ─── TRUST STRIP ─────────────────────────────────────────
   Slot right below the hero. Apple + CRO playbook: re-assure the user
   the minute they land (no card needed, real payment providers, real
   guarantee). High-impact, low-real-estate. */
function TrustStrip() {
  return (
    <section className={styles.trustStrip}>
      <div className={styles.container}>
        <div className={styles.trustRow}>
          <div className={styles.trustGroup}>
            <span className={styles.trustLabel}>תשלום</span>
            <div className={styles.trustPills}>
              <Image src="/payments/visa.webp" alt="Visa" width={204} height={136} className={styles.trustLogo} />
              <Image src="/payments/mastercard.webp" alt="Mastercard" width={204} height={132} className={styles.trustLogo} />
              <Image src="/payments/amex.webp" alt="American Express" width={190} height={126} className={styles.trustLogo} />
              <Image
                src="/payments/apple-pay.webp"
                alt="Apple Pay"
                width={198}
                height={136}
                className={styles.trustLogo}
              />
              <Image
                src="/payments/google-pay.webp"
                alt="Google Pay"
                width={1280}
                height={610}
                className={styles.trustLogo}
              />
              <Image
                src="/payments/paybox.webp"
                alt="PayBox"
                width={1262}
                height={836}
                className={`${styles.trustLogo} ${styles.trustLogoPaybox}`}
              />
              <Image
                src="/payments/bit.webp"
                alt="Bit"
                width={28}
                height={28}
                className={`${styles.trustLogo} ${styles.trustLogoBit}`}
              />
            </div>
          </div>
          <div className={styles.trustDivider} aria-hidden />
          <div className={styles.trustPromises}>
            <span className={styles.trustPromise}>
              <strong>7 ימים על חשבוננו</strong>
            </span>
            <span className={styles.trustPromise}>בלי כרטיס אשראי</span>
            <span className={styles.trustPromise}>ביטול בקליק</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ────────────────────────────────────────
   The three concrete steps a new merchant goes through. Big numbered
   discs, one-line each, no jargon. Wolt + Apple Pay both lead with a
   pattern like this on their merchant landings. */
function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "הרשמה ב-2 דקות",
      body: "אימייל + סיסמה. בלי טפסים, בלי טלפון ממכירות.",
    },
    {
      n: "2",
      title: "מקלידים תפריט ולוגו",
      body: "ייבוא מ-CSV או הוספה ידנית. גדלים, תוספות וצבעים - בעורך אחד.",
    },
    {
      n: "3",
      title: "החנות עולה לאוויר",
      body: "כתובת לשתף בוואטסאפ, על הדומיין שלך, מקבלת הזמנות מהדקה הראשונה.",
    },
  ];
  return (
    <section className={styles.howItWorks}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>איך זה עובד</div>
        <h2 className={styles.sectionTitle}>
          11 דקות. <em>שלוש פעולות.</em>
        </h2>
        <div className={styles.howGrid}>
          {steps.map((s, i) => (
            <article key={s.n} className={styles.howStep}>
              <div className={styles.howNum} aria-hidden>{s.n}</div>
              <h3 className={styles.howStepTitle}>{s.title}</h3>
              <p className={styles.howStepBody}>{s.body}</p>
              {i < steps.length - 1 && (
                <div className={styles.howConnector} aria-hidden />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ SCHEMA (SEO) ────────────────────────────────────
   schema.org JSON-LD for the FAQ. Lets Google render the questions
   as rich snippets directly in search results - well-documented CTR
   lift on long-tail searches like "מערכת הזמנות לפיצרייה".
   Source of truth for question/answer text mirrors the Faq() copy
   below; keep them in sync if either changes. */
function FaqSchema() {
  const qa: Array<[string, string]> = [
    [
      "תוך כמה זמן אני באוויר?",
      "בערך 11 דקות. נרשמים, בוחרים צבעים ולוגו, מקלידים תפריט בסיסי, מחברים את חשבון התשלום - ויש לך כתובת לשתף בוואטסאפ. ליווי אישי בהקמה - חינם, פשוט תפנה אלינו.",
    ],
    [
      "אז מה זה ה-0.5%?",
      "זו עמלת הסליקה שאנחנו גובים על כל הזמנה - מה שאתה משלם לחברת האשראי שלך פלוס תוספת מינימלית על הפעולה. הלקוח שילם 100 ש״ח? חמישים אגורות יורדו לך, וזהו. כל השאר - שלך, כולל הלקוח עצמו, ההיסטוריה שלו והמספר שלו.",
    ],
    [
      "איזה אמצעי תשלום הלקוח רואה?",
      "Bit, כרטיס אשראי, Apple Pay, פייבוקס, Google Pay. כולם נפתחים בתוך המסך של החנות שלך - בלי דפים חיצוניים, בלי מסך תשלום נפרד. אתה גם בוחר בדשבורד איזה אמצעי תשלום יהיה ברירת המחדל הראשונה.",
    ],
    [
      "מה עם וואטסאפ ו-SMS?",
      "מייל אנחנו שולחים ללא הגבלה, חינם. וואטסאפ ו-SMS - חבילות שמתחילות מ-₪39, ונשלפות אוטומטית לאישור הזמנה, ׳יצא לדרך׳ ולבקשת ביקורת. הוואטסאפ עובד מהמספר שלך (דרך iBot Chat), לא ממספר משותף.",
    ],
    [
      "אוספים ביקורות אוטומטית?",
      "כן. שעה אחרי שהזמנה סומנה ׳נמסרה׳, הלקוח מקבל הודעה (וואטסאפ / SMS / מייל - אתה בוחר) עם לינק להשארת דירוג. הכוכבים מצטברים בדשבורד שלך, ואתה עונה על תגובות מאותו מסך.",
    ],
    [
      "אפשר לחבר לקופה הקיימת?",
      "כן. REST API מלא + Webhooks יוצאים על כל אירוע (הזמנה חדשה, שינוי סטטוס, וכו׳). מתחבר ל-iCount, Wix Restaurants, או לכל מערכת אחרת. אינטגרציות built-in ל-iCount ו-idani בתכנון לרבעון הקרוב.",
    ],
    [
      "ואיך זה עובד עם משלוחים?",
      "שתי אפשרויות. אחת - מנהלים את השליחים שלך דרך המודול שלנו (כלול בתוכנית). שתיים - מתחברים לספק חיצוני. אזורי משלוח, זמן משלוח לאזור, דמי משלוח שונים - הכל בדשבורד.",
    ],
    [
      "הלקוח רואה דף תודה גנרי או מסך מעקב?",
      "לבחירתך. יש מתג בדשבורד - קבלה פשוטה כמו אתר אי-קומרס רגיל, או מסך מעקב חי עם זמן הגעה משוער, סטטוס ופרטי המסעדה. אם לא רוצה לחשוף זמני הכנה - מכבים.",
    ],
    [
      "מה אם בעוד שנה תעלו לי את המחיר?",
      "לא נעלה. המחיר מחיר קבוע לכל החיים - ₪299 + מע״מ וחצי אחוז על הזמנה. אם נשנה את התמחור בעתיד, זה יחול רק על מי שייכנס אחרי השינוי. אתה תישאר במחיר ההצטרפות שלך.",
    ],
    [
      "אני יכול לקבל את הקוד או אפליקציה משלי ב-App Store?",
      "לארגונים גדולים יש אפשרות לקבל את הקוד מחוץ לפלטפורמה, וגם אפליקציה ייעודית ב-App Store ו-Google Play בשם שלך. פנו אלינו ונדבר ישירות.",
    ],
  ];
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/* ─── NAV ────────────────────────────────────────────────── */
function Nav() {
  return (
    <nav className={styles.nav}>
      <div className={`${styles.container} ${styles.navRow}`}>
        <a href="#" className={styles.brand}>
          QuickFood
        </a>
        <div className={styles.navCta}>
          <Link href="/dashboard/login" className={`${styles.btn} ${styles.btnGhost}`}>התחברות</Link>
          <Link href="/signup" className={`${styles.btn} ${styles.btnInk}`}>התחל ניסיון</Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── HERO ───────────────────────────────────────────────── */
function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.container}>
        <h1 className={styles.headline}>
          <span className={styles.stack}>הלקוחות שלך.</span>
          <span className={styles.stack}>ההזמנות שלך.</span>
          <span className={styles.stack}>
            <Typewriter words={["הכסף שלך.", "הזמן שלך.", "הצמיחה שלך.", "העתיד שלך."]} />
          </span>
        </h1>
        <p className={styles.headlineSmall}>
          פלטפורמה שנבנתה מהיום הראשון לעולם המזון. מהתפריט עד הקבלה, מהמטבח עד הביקורת - בקצב של משמרת ובשפה של מי שמכין אוכל ומוסר אותו.
        </p>

        <div className={styles.heroCta}>
          <Link href="/signup" className={`${styles.btn} ${styles.btnTomato} ${styles.btnLg}`}>
            QuickFood, תפתחו לי חנות
          </Link>
          <a
            href="#pricing"
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostOutline} ${styles.btnLg}`}
          >
            כמה זה עולה <IcoArrowLeft c="currentColor" s={14} />
          </a>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>₪299</div>
            <div className={styles.heroStatL}>לחודש. מחיר קבוע לכל החיים.</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>0.5%</div>
            <div className={styles.heroStatL}>פר הזמנה. לא שלושים.</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>11 דק׳</div>
            <div className={styles.heroStatL}>מהרישום ועד חנות חיה.</div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── SUITED FOR (rotating food types) ──────────────────── */
function SuitedFor() {
  const types = [
    "פיצרייה",
    "המבורגרייה",
    "סושייה",
    "שווארמייה",
    "פלאפלייה",
    "מאפייה",
    "גלידרייה",
    "סטייקייה",
    "מטבח אסיאתי",
    "מטבח איטלקי",
    "אוכל ים-תיכוני",
    "אוכל טבעוני",
    "ארוחת בוקר",
    "קייטרינג",
    "בר משקאות",
    "מטבח כשר",
  ];
  return (
    <section className={styles.suitedSection}>
      <div className={styles.container}>
        <div className={styles.suitedEyebrow}>מתאים ל</div>
        <h2 className={styles.suitedHeadline}>
          <VerticalRotator
            words={types}
            wordClassName={styles.suitedWord}
            className={styles.suitedRotator}
          />
        </h2>
        <p className={styles.suitedFoot}>
          ולכל מי שמכין אוכל ומוסר אותו. אם זה אוכל, יש לו בית ב-QuickFood.
        </p>
      </div>
    </section>
  );
}

/* ─── WHY FOOD-FIRST ─────────────────────────────────────── */
function Math() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>נולד למזון</div>
        <h2 className={styles.sectionTitle}>
          לא חנות אונליין שמנסה למכור מנות. <em>תפריט שמדבר את השפה של המטבח.</em>
        </h2>

        <div className={styles.problemGrid}>
          <div className={`${styles.problemCard} ${styles.problemCardPeach}`}>
            <div className={styles.problemNum}>התפריט</div>
            <h3>גדלים, תוספות, חצי-חצי, רטבים בצד.</h3>
            <p>
              כל פריט נבנה עם גדלים (אישית · משפחתית · XL), קבוצות אפשרויות (סוג בצק, רטב צד, מילוי), תוספות עם תמחור לכל יחידה ומגבלת מקסימום. הלקוח רואה את הסכום מתעדכן בכל קליק. אתה רואה בקבלה בדיוק &quot;בלי בצל, חתוך ל-8&quot;.
            </p>
          </div>
          <div className={`${styles.problemCard} ${styles.problemCardMist}`}>
            <div className={styles.problemNum}>המטבח</div>
            <h3>זמן הכנה לכל מנה. סטטוסים אמיתיים.</h3>
            <p>
              3 דק׳ לסלט, 11 לפיצה - אתה מגדיר פר-פריט, האפליקציה מחשבת זמן משוער להכנת המנה. סטטוסים שאתה מכיר: "בתנור", "בטיגון", "מוכן", "יצא לדרך". לא "processing" של חברת שילוח.
            </p>
          </div>
          <div className={`${styles.problemCard} ${styles.problemCardLilac}`}>
            <div className={styles.problemNum}>המשמרת</div>
            <h3>מערכת הזמנות חכמה.</h3>
            <p>
              סטטוס משתנה לכל הזמנה בלחיצת כפתור באפליקציית הקופה שלנו. ממשק פשוט וקל שעושה סדר ומשקף גם ללקוח בכל רגע איפה ההזמנה שלו בזמן אמת. <strong>חדש:</strong> בשעת עומס המערכת מזהה אוטומטית ומעלה את הזמן המשוער להכנת המנה.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PRODUCT SHOWCASE ──────────────────────────────────── */
/* ─── FEATURES ────────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מה מקבלים</div>
        <h2 className={styles.sectionTitle}>
          הכל מותאם למזון. <em>בלי שום דבר שלא.</em>
        </h2>

        <div className={styles.woltStack}>
          <CustomizerWoltCard
            tag="התפריט"
            heading="תוספות, גדלים, וחצי-חצי. כמו בוולט. רק שלך."
            body="כל מנה - גדלים (אישית 25 / משפחתית 32 / XL 40), קבוצות אפשרויות עם בחירת חובה ('סוג בצק', 'רטב צד'), תוספות עם תמחור לכל יחידה ומגבלת מקסימום, והערות חופשיות לטבח. הלקוח רואה את המחיר מתעדכן בכל קליק. הקבלה אצלך מציינת בדיוק מה לא לשים."
          />

          <WoltCard
            tone="mist"
            layout="decor-start"
            tag="החנות"
            heading="עיצוב משלך. דומיין משלך. הלקוחות - שלך."
            body="לוגו שלך, צבעים שלך, שם שלך, דומיין משלך (domain.co.il). שעות פעילות נפרדות לכל סניף, מינימום הזמנה, אזורי משלוח עם זמן משלוח לכל שכונה. הלקוח לא רואה אותנו ולא רואה אף אחד אחר - רק אותך."
            icon="store"
          />

          <WoltCard
            tone="sand"
            layout="decor-end"
            tag="המטבח"
            heading="זמן הכנה לכל פריט. סטטוסים בשפה של המטבח."
            body="3 דק׳ לסלט, 9 לפיצה, 12 להמבורגר - אתה מגדיר, האפליקציה מחשבת זמן משוער להכנת המנה. סטטוס מסעדה פתוח / עומס / סגור - במצב עומס הזמן המשוער מתארך אוטומטית עוד לפני שהלקוח לוחץ ׳שלם׳. דשבורד שעובד על טאבלט ליד הקופה."
            icon="flame"
          />

          <WoltCard
            tone="peach"
            layout="decor-start"
            tag="תשלום"
            heading="Bit, אשראי, Apple Pay, פייבוקס, Google Pay - הכל נתמך בצ׳קאוט אחד."
            body="הלקוח לוחץ ׳שלם׳ בתוך החנות, ארנק התשלום נפתח לידו, מקיש PIN ב-Bit או טביעת אצבע ב-Apple Pay - והכסף בחשבון תוך 24 שעות. בלי הפניות, בלי מסך תשלום נפרד. אתה בוחר ברירת מחדל בדשבורד."
            icon="wallet"
          />

          <WoltCard
            tone="lilac"
            layout="decor-end"
            tag="ביקורות"
            heading="הוא יקבל וואטסאפ. אתה תקבל את הכוכב החמישי."
            body="שעה אחרי המסירה, המערכת שולחת לו אוטומטית תזכורת לדרג. SMS, וואטסאפ או מייל - אתה בוחר. הכוכבים מצטברים בדשבורד, ואתה עונה לכל ביקורת מאותו מסך."
            icon="star"
          />

          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="וואטסאפ"
            heading="ההודעות מהמספר שלך. לא מאיזה +1."
            body="אישור הזמנה, ׳יצא לדרך׳, בקשת ביקורת - יוצאים אוטומטית מהמספר של החנות שלך דרך iBot Chat. חבילות מ-₪39 לאלפי הודעות. מייל חינם, ללא הגבלה."
            icon="chat"
          />
        </div>

        <div className={styles.miniGrid}>
          <MiniCell tag="סניפים" title="מולטי-סניף" body="שעות, דמי משלוח, עמלת שירות ומינימום הזמנה נפרדים לכל סניף." />
          <MiniCell tag="שליחים" title="ניהול שליחים שלך" body="אזורי משלוח עם זמן משלוח לכל אזור, הקצאה אוטומטית או ידנית, היסטוריית משלוחים." />
          <MiniCell tag="קופונים" title="קופונים חכמים" body="לפי קטגוריה, סכום מינימום, מגבלת שימוש פר-לקוח, חלון תאריכים." />
          <MiniCell tag="מעקב" title="מעקב הזמנה חי" body="עדכון בזמן אמת ללקוח - בלי לרענן את המסך. אופציונלי לפי בחירה." />
          <MiniCell tag="תזמון" title="הזמנות מראש" body="הלקוח בוחר שעת מסירה או איסוף ספציפית - 'תאסוף לי בשמונה' - במקום 'בהקדם האפשרי'. אופציונלי, נשלט מהדשבורד." />
          <MiniCell tag="אנליטיקה" title="נתונים אמיתיים" body="שעות שיא, פריטים מובילים, AOV, אחוז חזרה של לקוחות." />
          <MiniCell tag="חיבורים" title="Webhooks + REST" body="זפייר, Make, קופות רושמות וכל מערכת חיצונית שמדברת HTTP - מתחברות בלי כאב ראש." />
        </div>
      </div>
    </section>
  );
}

/* Customizer-mockup variant of the wolt-card - used once, for the anchor
   "תוספות, גדלים, חצי-חצי" feature card. Lives in the same `.woltStack`
   so the rhythm of the section stays intact. */
function CustomizerWoltCard({
  tag,
  heading,
  body,
}: {
  tag: string;
  heading: string;
  body: string;
}) {
  return (
    <article className={`${styles.woltCard} ${styles.woltCardMidnight} ${styles.woltCardCustomizer}`}>
      <div className={styles.woltCardBody}>
        <div className={styles.woltCardTag}>{tag}</div>
        <h3 className={styles.woltCardHeading}>{heading}</h3>
        <p className={styles.woltCardCopy}>{body}</p>
      </div>
      <div className={styles.woltCardMockup}>
        <div className={styles.mockupAnnotation} aria-hidden>
          <span className={styles.mockupAnnotationText}>נסו ללחוץ — זה חי!</span>
          <svg
            className={styles.mockupAnnotationArrow}
            viewBox="0 0 110 90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Hand-drawn squiggly arrow that curls from the caption down
                to the customizer card's top-end corner. Two loose curves
                then an arrowhead. */}
            <path d="M10 12 C 35 8, 60 22, 70 42 S 85 78, 95 80" />
            <path d="M83 70 L 95 80 L 88 88" />
          </svg>
        </div>
        <div aria-hidden>
          <ItemCustomizerMockup />
        </div>
      </div>
    </article>
  );
}

type WoltTone = "mist" | "sand" | "peach" | "lilac" | "midnight";
type WoltLayout = "decor-end" | "decor-start" | "wide";

function WoltCard({
  tone,
  layout = "decor-end",
  tag,
  heading,
  body,
  icon,
}: {
  tone: WoltTone;
  layout?: WoltLayout;
  tag: string;
  heading: string;
  body: string;
  icon: IconName;
}) {
  const toneClass = {
    mist: styles.woltCardMist,
    sand: styles.woltCardSand,
    peach: styles.woltCardPeach,
    lilac: styles.woltCardLilac,
    midnight: styles.woltCardMidnight,
  }[tone];
  const layoutClass = {
    "decor-end": styles.woltCardDecorEnd,
    "decor-start": styles.woltCardDecorStart,
    wide: styles.woltCardWide,
  }[layout];
  return (
    <article className={`${styles.woltCard} ${toneClass} ${layoutClass}`}>
      <div className={styles.woltCardDecor} aria-hidden>
        <FeatureIcon name={icon} />
      </div>
      <div className={styles.woltCardBody}>
        <div className={styles.woltCardTag}>{tag}</div>
        <h3 className={styles.woltCardHeading}>{heading}</h3>
        <p className={styles.woltCardCopy}>{body}</p>
      </div>
    </article>
  );
}

function MiniCell({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className={styles.miniCell}>
      <span className={styles.miniCellTag}>{tag}</span>
      <h4 className={styles.miniCellTitle}>{title}</h4>
      <p className={styles.miniCellBody}>{body}</p>
    </div>
  );
}

/* ─── GROW PARTNER ──────────────────────────────────────────
   Preferred-provider announcement for Grow Payments. Frames the deal
   as a partnership benefit (better terms than going direct) while
   making it explicit that Grow is a third party and any other
   processor still works — we don't lock you in. */
function GrowPartner() {
  return (
    <section id="grow" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>חדש · ספק סליקה מועדף</div>
        <h2 className={styles.sectionTitle}>
          סליקה דרך Grow. <em>סנכרון מלא לדשבורד. בלי תוספות.</em>
        </h2>
        <p className={styles.sectionLede}>
          חברת הסליקה <strong>Grow</strong> מנהלת תשלומים ל-100,000 עסקים בישראל. דרך QuickFood היא מחוברת ישירות לדשבורד שלך — ביטולים, זיכויים, חשבוניות מס וכל אמצעי התשלום מסונכרנים אוטומטית, בלי לעבור בין מערכות.
        </p>

        <div className={styles.growCard}>
          <div className={styles.growBrandRow}>
            <div className={styles.growBrand}>
              <Image
                src="/brands/grow-mark.svg"
                alt="Grow"
                width={76}
                height={98}
                className={styles.growMark}
              />
              <div>
                <div className={styles.growBrandName}>Grow</div>
                <div className={styles.growBrandTag}>סליקה · חשבוניות · בנקאות עסקית</div>
              </div>
            </div>
            <a
              href="https://grow.business/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.growLearnLink}
            >
              למידע על Grow <IcoArrowLeft c="currentColor" s={12} />
            </a>
          </div>

          <div className={styles.growSplit}>
            <div className={styles.growPrice}>
              <div className={styles.growPriceCell}>
                <div className={styles.growPriceN}>1%</div>
                <div className={styles.growPriceL}>עמלת סליקה לכל הזמנה</div>
              </div>
              <div className={styles.growPriceDivider} aria-hidden />
              <div className={styles.growPriceCell}>
                <div className={styles.growPriceN}>₪69</div>
                <div className={styles.growPriceL}>חודשי. לא תלוי במחזור.</div>
              </div>
              <div className={styles.growPriceNote}>
                התעריף משולם ישירות ל-Grow, לא ל-QuickFood. שני התעריפים מצטרפים לעמלות הפלטפורמה שלנו (₪299 / 0.5%).
              </div>
            </div>

            <ul className={styles.growList}>
              <li>
                <strong>סנכרון מלא: ביטולים וזיכויים מהדשבורד</strong>
                <span>ביטלת הזמנה? החיוב חוזר ללקוח בקליק אחד, הסכום מתעדכן ב-Grow, החשבונית הקודמת מתבטלת אוטומטית. בלי לעבור בין שתי מערכות, בלי טעויות הנהלת חשבונות.</span>
              </li>
              <li>
                <strong>פייבוקס, ביט, Apple Pay, Google Pay — בלי תוספת</strong>
                <span>אמצעי תשלום שספקים אחרים גובים עליהם בנפרד או דורשים &quot;חבילת תוספים&quot; — אצל Grow הכל כלול בתעריף הבסיס. בלי הפעלה ידנית, בלי עמלה אחרת לכל אחד.</span>
              </li>
              <li>
                <strong>חשבוניות מס ללא הגבלה — כלולות במנוי</strong>
                <span>על כל הזמנה Grow מנפיקה חשבונית מס תקנית, שולחת ללקוח ומגישה לרשויות. בלי תקרת חודש, בלי תשלום נוסף, בלי חשבון נפרד אצל סולק חשבוניות.</span>
              </li>
              <li>
                <strong>תשלום מהיר לחשבון — תוך 24 שעות</strong>
                <span>יום עסקים אחד מההזמנה ועד שהכסף בבנק שלך. בלי תור, בלי תקרה יומית, בלי חודש המתנה כמו אצל סולקים מסורתיים.</span>
              </li>
              <li>
                <strong>חיבור בקליק אחד</strong>
                <span>נרשמים ל-Grow מתוך הדשבורד של QuickFood. ההתאמה הראשונית מסתיימת תוך דקות. מתחיל לסלוק היום למחר.</span>
              </li>
            </ul>
          </div>

          <div className={styles.growFootnote}>
            <strong>שקיפות מלאה:</strong> Grow היא חברת סליקה עצמאית — לא חברת-בת שלנו. אנחנו ממליצים עליה כספק מועדף כי השגנו ללקוחות QuickFood אינטגרציה מלאה ותעריפים טובים. אבל <strong>אפשר לחבר כל חברת סליקה אחרת</strong> שעובדת איתך — Tranzila, CardCom, Pelecard, Isracard וכל מי שתומך ב-API סטנדרטי. הבחירה שלך, לא נועלים אותך.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PRICING ───────────────────────────────────────────── */
function Pricing() {
  const features = [
    "מנות עם גדלים, אפשרויות חובה ותוספות פר-יחידה",
    "זמן הכנה לכל פריט + זמן משוער מצרפי לכל הזמנה",
    "סטטוס מסעדה: פתוח / עומס / סגור - זמן הגעה משוער אוטומטי",
    "אפליקציית לקוח ממותגת על דומיין שלך",
    "דשבורד ניהול הזמנות חי - תפריט ושליחים",
    "תשלום inline - Bit, אשראי, Apple Pay, פייבוקס, Google Pay",
    "מעקב הזמנה חי + סטטוס בלייב",
    "ביקורות אוטומטיות עם תזכורת בוואטסאפ",
    "וואטסאפ מהמספר שלך (דרך iBot Chat)",
    "מייל ללא הגבלה - חינם",
    "אזורי משלוח עם זמן משלוח לכל אזור",
    "מולטי-סניף עם הגדרות נפרדות",
    "אנליטיקה - שעות שיא, פריטים מובילים, חוזרים",
    "REST API + Webhooks לחיבור לקופה",
  ];
  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.pricingHead}>
          <div className={styles.sectionEyebrow}>כמה זה עולה</div>
          <h2 className={styles.sectionTitle}>
            תוכנית אחת. <em>מחיר קבוע לכל החיים.</em>
          </h2>
          <p className={styles.sectionLede}>
            בלי דרגות תמחור, בלי הפתעות בעוד שנה, בלי שדרוגים כפויים. אותו מחיר היום, אותו מחיר בעוד עשר שנים - בלי תלות בכמה הזמנות יצאו לך החודש.
          </p>
        </div>

        <div className={styles.priceSingleWrap}>
          <article className={styles.priceSingle}>
            <div className={styles.priceSingleHead}>
              <div className={styles.priceSingleTag}>תוכנית יחידה · מחיר קבוע</div>
              <div className={styles.priceSingleAmounts}>
                <div className={styles.priceSingleAmount}>
                  <span className={styles.priceSingleNum}>₪299</span>
                  <span className={styles.priceSingleUnit}>/ חודש</span>
                </div>
                <div className={styles.priceSingleSub}>+ מע״מ. מחיר קבוע לכל החיים.</div>
              </div>
              <div className={styles.priceSingleFee}>
                <span className={styles.priceSingleFeeNum}>0.5%</span>
                <span className={styles.priceSingleFeeLabel}>
                  עמלת סליקה לכל הזמנה
                  <small> + מע״מ. בערך כמו עמלת כרטיס אשראי רגילה.</small>
                </span>
              </div>
              <Link
                href="/signup"
                className={`${styles.btn} ${styles.btnLg} ${styles.btnInk} ${styles.btnFull}`}
              >
                QuickFood, תפתחו לי חנות <IcoArrowLeft c="currentColor" s={14} />
              </Link>
              <div className={styles.priceSingleNote}>
                7 ימים על חשבוננו · בלי כרטיס אשראי · בלי שיחת מכירה
              </div>
            </div>
            <div className={styles.priceSingleBody}>
              <div className={styles.priceSingleIncluded}>כלול במחיר:</div>
              <ul className={styles.priceFeatures}>
                {features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className={styles.priceSingleAddon}>
                <div className={styles.priceSingleAddonTag}>אופציונלי</div>
                <div className={styles.priceSingleAddonBody}>
                  <strong>חבילות וואטסאפ + SMS מ-₪39.</strong>
                  <span>
                    קונים פעם אחת, נשלפת אוטומטית לאישור הזמנה, ליציאה לדרך ולבקשות ביקורת. מייל חינם, ללא הגבלה.
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────── */
function Faq() {
  return (
    <section id="faq" className={`${styles.section} ${styles.faq}`}>
      <div className={styles.container}>
        <div className={styles.faqGrid}>
          <div>
            <div className={styles.sectionEyebrow}>שאלות נפוצות</div>
            <h2 className={styles.sectionTitle}>
              השאלות <em>שכנראה תרצה לשאול.</em>
            </h2>
            <p className={styles.faqIntro}>
              לא מצאת תשובה? כתוב לנו ב-WhatsApp ונחזור תוך שעה.
            </p>
            <a href="#" className={`${styles.btn} ${styles.btnInk}`} style={{ marginTop: 24 }}>
              WhatsApp לתמיכה
            </a>
          </div>

          <div>
            <details className={styles.faqItem} open>
              <summary>תוך כמה זמן אני באוויר?</summary>
              <p>
                בערך 11 דקות. נרשמים, בוחרים צבעים ולוגו, מקלידים תפריט בסיסי, מחברים את חשבון התשלום - ויש לך כתובת לשתף בוואטסאפ. ליווי אישי בהקמה - חינם, פשוט תפנה אלינו.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אז מה זה ה-0.5%?</summary>
              <p>
                זו עמלת הסליקה שאנחנו גובים על כל הזמנה - מה שאתה משלם לחברת האשראי שלך פלוס תוספת מינימלית על הפעולה. הלקוח שילם 100 ש״ח? חמישים אגורות יורדו לך, וזהו. כל השאר - שלך, כולל הלקוח עצמו, ההיסטוריה שלו והמספר שלו.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>איזה אמצעי תשלום הלקוח רואה?</summary>
              <p>
                Bit, כרטיס אשראי, Apple Pay, פייבוקס, Google Pay. כולם נפתחים בתוך המסך של החנות שלך - בלי דפים חיצוניים, בלי מסך תשלום נפרד. אתה גם בוחר בדשבורד איזה אמצעי תשלום יהיה ברירת המחדל הראשונה.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>מה עם וואטסאפ וSMS?</summary>
              <p>
                מייל אנחנו שולחים ללא הגבלה, חינם. וואטסאפ ו-SMS - חבילות שמתחילות מ-₪39, ונשלפות אוטומטית לאישור הזמנה, ׳יצא לדרך׳ ולבקשת ביקורת. הוואטסאפ עובד מהמספר שלך (דרך iBot Chat), לא ממספר משותף.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אוספים ביקורות אוטומטית?</summary>
              <p>
                כן. שעה אחרי שהזמנה סומנה ׳נמסרה׳, הלקוח מקבל הודעה (וואטסאפ / SMS / מייל - אתה בוחר) עם לינק להשארת דירוג. הכוכבים מצטברים בדשבורד שלך, ואתה עונה על תגובות מאותו מסך.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אפשר לחבר לקופה הקיימת?</summary>
              <p>
                כן. REST API מלא + Webhooks יוצאים על כל אירוע (הזמנה חדשה, שינוי סטטוס, וכו׳). מתחבר ל-iCount, Wix Restaurants, או לכל מערכת אחרת. אינטגרציות built-in ל-iCount ו-idani בתכנון לרבעון הקרוב.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>ואיך זה עובד עם משלוחים?</summary>
              <p>
                שתי אפשרויות. אחת - מנהלים את השליחים שלך דרך המודול שלנו (כלול בתוכנית). שתיים - מתחברים לספק חיצוני. אזורי משלוח, זמן משלוח לאזור, דמי משלוח שונים - הכל בדשבורד.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>הלקוח רואה דף תודה גנרי או מסך מעקב?</summary>
              <p>
                לבחירתך. יש מתג בדשבורד - קבלה פשוטה כמו אתר אי-קומרס רגיל, או מסך מעקב חי עם זמן הגעה משוער, סטטוס ופרטי המסעדה. אם לא רוצה לחשוף זמני הכנה - מכבים.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>מה אם בעוד שנה תעלו לי את המחיר?</summary>
              <p>
                לא נעלה. המחיר מחיר קבוע לכל החיים - ₪299 + מע״מ וחצי אחוז על הזמנה. אם נשנה את התמחור בעתיד, זה יחול רק על מי שייכנס אחרי השינוי. אתה תישאר במחיר ההצטרפות שלך.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אני יכול לקבל את הקוד או אפליקציה משלי ב-App Store?</summary>
              <p>
                לארגונים גדולים יש אפשרות לקבל את הקוד מחוץ לפלטפורמה, וגם אפליקציה ייעודית ב-App Store ו-Google Play בשם שלך. פנו אלינו ונדבר ישירות.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FINAL CTA ───────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className={styles.finalCta}>
      <div className={styles.container}>
        <div className={styles.finalCtaCard}>
          <div className={styles.finalCtaBody}>
            <span className={styles.finalCtaTag}>7 ימים על חשבוננו</span>
            <h2>
              11 דקות. <em>וזה כבר שלך.</em>
            </h2>
            <p>
              בלי כרטיס אשראי, בלי התחייבות, בלי שיחת מכירה. תפתח חנות, תקבל הזמנה אחת, ותראה איך זה מרגיש כשהמנה הולכת ישר מהמטבח שלך ללקוח שלך - עם השם שלך על האפליקציה.
            </p>
            <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnInk}`}>
              QuickFood, תפתחו לי חנות <IcoArrowLeft c="currentColor" s={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footGrid}>
          <div>
            <div className={styles.footBrand}>
              QuickFood
              <small>BY QUICKSHOP - TEL AVIV / 2026</small>
            </div>
            <p className={styles.footTag}>
              פלטפורמת הזמנות שנבנתה לעולם המזון מהיום הראשון. תפריט, מטבח, משלוח וביקורות - תחת השם שלך, על הדומיין שלך.
            </p>
          </div>
          <div className={styles.footCol}>
            <h5>מוצר</h5>
            <a href="#features">דשבורד</a>
            <a href="#features">אפליקציה</a>
            <a href="#features">פיצ&apos;רים</a>
            <a href="#pricing">תמחור</a>
          </div>
          <div className={styles.footCol}>
            <h5>חברה</h5>
            <a href="#">אודות</a>
            <a href="#">בלוג</a>
            <a href="#">קריירה</a>
            <a href="#">צור קשר</a>
          </div>
          <div className={styles.footCol}>
            <h5>מסמכים</h5>
            <a href="#">תנאי שימוש</a>
            <a href="#">פרטיות</a>
            <a href="#">SLA</a>
            <Link href="/api/v1/openapi">API Docs</Link>
          </div>
        </div>
        <div className={styles.footBottom}>
          <span>© 2026 Quickshop Ltd. כל הזכויות שמורות.</span>
          <span className={styles.mono}>v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}
