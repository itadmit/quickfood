import type { Metadata } from "next";
import Image from "next/image";
import { Rubik, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { IcoArrowLeft, IcoWhatsApp } from "@/components/shared/Icons";
import Typewriter from "./_components/Typewriter";
import { LiteYouTube } from "./_components/LiteYouTube";
import VerticalRotator from "./_components/VerticalRotator";
import GrowthPromoPopup from "./_components/GrowthPromoPopup";
import BottomCtaPopup from "./_components/BottomCtaPopup";
import { WhatsAppFAB } from "./_components/WhatsAppFAB";
import {
  Store,
  Flame,
  Wallet,
  Star,
  MessageCircle,
  ChefHat,
  Pizza,
  MapPin,
  Heart,
  Navigation,
  Sparkles,
  Leaf,
  Users,
  Crown,
  Check,
  X,
  QrCode,
  Compass,
  Send,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

// Tight map for the WoltCard slots - extend here when a new section
// needs an icon. Lucide gives consistent stroke + geometry which the
// old hand-rolled FeatureIcon set didn't.
type IconName = "store" | "flame" | "wallet" | "star" | "chat" | "chef" | "pizza" | "pin" | "heart" | "navigation" | "sparkles" | "leaf" | "users" | "crown";
const ICONS: Record<IconName, LucideIcon> = {
  store: Store,
  flame: Flame,
  wallet: Wallet,
  star: Star,
  chat: MessageCircle,
  chef: ChefHat,
  pizza: Pizza,
  pin: MapPin,
  heart: Heart,
  navigation: Navigation,
  sparkles: Sparkles,
  leaf: Leaf,
  users: Users,
  crown: Crown,
};
import ItemCustomizerMockup from "./_components/ItemCustomizerMockup";
import ScrollAnimations from "./_components/ScrollAnimations";
import WoltTeaser from "./_components/WoltTeaser";
import { LeadForm } from "@/components/marketing/LeadForm";
import { AccessibilityWidget } from "@/components/shared/AccessibilityWidget";
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
  // Title bakes in (a) Hebrew brand spellings users actually type into
  // Google ("קוויקפוד", "קוויק פוד"), (b) the dominant intent phrase

  title:
    "QuickFood · קוויקפוד - אתר הזמנות למסעדה | חנות אונליין לפיצרייה, המבורגרייה, סושייה",
  description:
    "QuickFood (קוויקפוד) - מערכת צמיחה למסעדות עם אתר הזמנות רשמי וממותג: דומיין משלך, מועדון לקוחות, קמפייני QR, יועץ AI בעברית, קאנבן הזמנות חי, מסך מטבח וסליקת אשראי/Bit/Apple Pay. אפליקציות המשלוחים מביאות לקוחות חדשים - QuickFood מחזירה את הקבועים להזמין ישירות ממך, עם חיסכון משוער בעמלות. ₪299 לחודש מחיר קבוע + 0.5% להזמנה. 7 ימים ניסיון בלי כרטיס.",
  keywords: [
    "אתר הזמנות למסעדה",
    "מערכת הזמנות למסעדה",
    "מערכת הזמנות למסעדות",
    "אתר הזמנות לפיצרייה",
    "הזמנות ישירות למסעדה",
    "מועדון לקוחות למסעדה",
    "מערכת משלוחים למסעדה",
    "חנות אונליין למסעדה",
    "מערכת הזמנות לפיצרייה",
    "מערכת הזמנות להמבורגרייה",
    "אפליקציה למסעדה",
    "אתר משלך למסעדה",
    "אתר הזמנות לצד וולט",
    "פלטפורמת הזמנות אוכל",
    "תפריט דיגיטלי למסעדה",
    "אתר משלוחים למסעדה",
    "אתר משלוחים לפיצרייה",
    "מערכת ניהול מסעדה",
    "QuickFood",
    "קוויקפוד",
    "קוויק פוד",
    "Quick Food",
    "restaurant online ordering platform Israel",
    "restaurant ordering website",
    "white label restaurant website",
    "alternative to Wolt",
  ],
  alternates: {
    canonical: "https://quickfood.co.il",
    languages: { "he-IL": "https://quickfood.co.il" },
  },
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "https://quickfood.co.il",
    siteName: "QuickFood",
    title: "QuickFood (קוויקפוד) - חנות אונליין למסעדה שלך",
    description:
      "פלטפורמה ישראלית להקמת אתר הזמנות למסעדה ב-5 דקות. תפריט עם תוספות וחצי-חצי, סליקה ב-Bit/אשראי/Apple Pay, ניהול שליחים, AI בעברית. ₪299 לחודש קבוע.",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuickFood (קוויקפוד) - חנות אונליין למסעדה שלך",
    description:
      "אתר הזמנות למסעדה ב-5 דקות. תפריט מלא, סליקה לכל אמצעי תשלום, ניהול שליחים, AI בעברית. ₪299/חודש.",
  },
};

export default function LandingPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${mono.variable}`}>
      <AccessibilityWidget />
      <FaqSchema />
      <Nav />
      <Hero />
      <TrustStrip />
      <AcquisitionVsDirect />
      <GrowthSystem />
      <DailyGrowthManager />
      <SuitedFor />
      <BornForFood />
      <Features />
      <PrinterShowcase />
      <LoyaltyClub />
      <KioskSection />
      <GrowPartner />
      <CompareSites />
      <MidCta />
      <WoltTeaser />
      <CustomerShowcase />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
      <ScrollAnimations />
      <GrowthPromoPopup />
      <BottomCtaPopup />
      <WhatsAppFAB />
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
              <strong>7 ימים ניסיון ללא תשלום</strong>
            </span>
            <span className={styles.trustPromise}>בלי כרטיס אשראי</span>
            <span className={styles.trustPromise}>ביטול בכל רגע</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── ACQUISITION vs DIRECT ───────────────────────────────
   The positioning anchor. Frames delivery apps as an acquisition
   channel and QuickFood as the repeat-direct channel - never
   "replace Wolt". Three mini-cells walk the customer journey:
   first order via app -> second via your own site -> profit stays. */
function AcquisitionVsDirect() {
  return (
    <section id="acquisition" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>גיוס מול לקוח חוזר</div>
        <h2 className={styles.sectionTitle}>
          לא מחליפים את אפליקציות המשלוחים. <em>מחזירים את הלקוח אליך.</em>
        </h2>
        <p className={styles.sectionLede}>
          אפליקציות משלוחים יכולות להביא לקוחות חדשים. הבעיה מתחילה כשהלקוח חוזר
          שוב ושוב - ואתה ממשיך לשלם עמלה גבוהה על כל הזמנה. QuickFood נותנת
          למסעדה שלך אתר רשמי להזמנות ישירות, עם מועדון לקוחות, קופונים, QR, דיוור,
          AI והזמנה חוזרת בלחיצה.
        </p>

        <div className={styles.miniGrid}>
          <MiniCell
            tag="פעם ראשונה"
            title="פעם ראשונה דרך אפליקציה"
            body="לקוח חדש גילה אותך דרך פלטפורמת משלוחים? מצוין. זה ערוץ גיוס."
          />
          <MiniCell
            tag="פעם שנייה"
            title="פעם שנייה דרך האתר שלך"
            body="עם QR, קופון, מועדון לקוחות והזמנה חוזרת - הלקוח חוזר ישירות אליך."
          />
          <MiniCell
            tag="הרווח"
            title="הרווח נשאר אצלך"
            body="פחות עמלות על לקוחות חוזרים, יותר שליטה על הקשר עם הלקוח, יותר דאטה לעסק."
          />
        </div>
      </div>
    </section>
  );
}

/* ─── GROWTH SYSTEM ───────────────────────────────────────
   "Not just an ordering site - a growth system." Six feature
   cells covering customer-source tracking, QR campaigns, loyalty,
   campaigns, AI insight and estimated commission savings. All
   source/savings language stays hedged ("משוער", "מבוסס QR"). */
function GrowthSystem() {
  const cards: Array<{ icon: LucideIcon; tag: string; title: string; body: string }> = [
    {
      icon: Compass,
      tag: "מקורות",
      title: "מקורות לקוחות",
      body: "לדעת אם לקוח הגיע מגוגל, אינסטגרם, QR, המלצה או פלטפורמת משלוחים - מבוסס על קישורי קמפיין, סריקות QR ודיווח עצמי של הלקוח.",
    },
    {
      icon: QrCode,
      tag: "QR",
      title: "קמפייני QR",
      body: "QR לשקית, קבלה, שולחן, פלייר או סטורי - עם מדידה של סריקות, הרשמות והזמנות.",
    },
    {
      icon: Crown,
      tag: "מועדון",
      title: "מועדון לקוחות",
      body: "נקודות, דרגות, VIP, ימי הולדת והטבות שמחזירות לקוחות להזמין שוב.",
    },
    {
      icon: Send,
      tag: "קמפיינים",
      title: "קמפיינים",
      body: "שליחת הודעות במייל, SMS ווואטסאפ דרך Poply.",
    },
    {
      icon: Sparkles,
      tag: "AI",
      title: "תובנות AI",
      body: "המערכת מציעה מה לעשות השבוע כדי להגדיל הזמנות ישירות.",
    },
    {
      icon: PiggyBank,
      tag: "חיסכון משוער",
      title: "חיסכון משוער בעמלות",
      body: "לראות כמה כסף נשאר אצלך כשהלקוחות מזמינים ישירות במקום דרך פלטפורמות - אומדן בלבד, לא הבטחה.",
    },
  ];
  return (
    <section id="growth" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מערכת צמיחה</div>
        <h2 className={styles.sectionTitle}>
          מערכת צמיחה למסעדות. <em>לא רק אתר הזמנות.</em>
        </h2>
        <p className={styles.sectionLede}>
          QuickFood עוזרת לך להבין מאיפה הלקוחות הגיעו, מי חזר להזמין, כמה הזמנות
          ישירות נכנסו וכמה כסף נשאר אצלך בזכות הזמנות ישירות.
        </p>

        <div className={styles.miniGrid}>
          {cards.map(({ icon: Icon, tag, title, body }) => (
            <div key={title} className={styles.miniCell}>
              <div className={styles.growthCellHead}>
                <span className={styles.miniCellTag}>{tag}</span>
                <span className={styles.growthCellIcon} aria-hidden>
                  <Icon strokeWidth={2} size={20} />
                </span>
              </div>
              <h4 className={styles.miniCellTitle}>{title}</h4>
              <p className={styles.miniCellBody}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── DAILY GROWTH MANAGER ────────────────────────────────
   A "what to do next" morning briefing, not analytics. The
   briefing card + action buttons are a decorative mockup
   (aria-hidden); the only live control is the trial CTA below. */
function DailyGrowthManager() {
  const items: Array<{ n: string; text: string; sub: string; action: string }> = [
    {
      n: "1",
      text: "14 לקוחות לא הזמינו כבר 30 יום.",
      sub: "אפשר לשלוח להם קופון חזרה.",
      action: "צור קופון",
    },
    {
      n: "2",
      text: "27 לקוחות קרובים לדרגת Gold.",
      sub: "כדאי לעודד אותם להזמין שוב השבוע.",
      action: "צור קמפיין",
    },
    {
      n: "3",
      text: "סריקות ה-QR מהשקיות ירדו ב-38%.",
      sub: "כדאי להזכיר לצוות להכניס פלייר לכל משלוח.",
      action: "הדפס QR",
    },
  ];
  return (
    <section id="daily" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מנהל צמיחה יומי</div>
        <h2 className={styles.sectionTitle}>
          כל בוקר: <em>מה כדאי לעשות כדי להחזיר לקוחות.</em>
        </h2>
        <p className={styles.sectionLede}>
          לא דוחות ולא גרפים. כל בוקר QuickFood מראה לך מה לעשות היום כדי להחזיר
          לקוחות ולהגדיל הזמנות ישירות - ומכינה לך את הקמפיין, הקופון או ה-QR
          בלחיצה.
        </p>

        <div className={styles.dailyCard}>
          <div className={styles.dailyGreeting}>
            <span className={styles.dailyGreetingHi}>בוקר טוב.</span>
            <span className={styles.dailyGreetingSub}>מצאנו 3 הזדמנויות היום:</span>
          </div>
          <ul className={styles.dailyList}>
            {items.map((it) => (
              <li key={it.n} className={styles.dailyItem}>
                <span className={styles.dailyItemNum} aria-hidden>{it.n}</span>
                <div className={styles.dailyItemText}>
                  <strong>{it.text}</strong>
                  <span>{it.sub}</span>
                </div>
                <span className={styles.dailyItemAction} aria-hidden>{it.action}</span>
              </li>
            ))}
          </ul>
          <div className={styles.dailyCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnInk} ${styles.btnLg}`}>
              התחילו 7 ימים חינם <IcoArrowLeft c="currentColor" s={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── COMPARE: not WordPress / Shopify / Wix ───────────────
   Side-by-side: a generic website vs QuickFood, built for food.
   Two card columns reuse the qfood card chrome; Check/X icons
   instead of dingbats per the no-emoji rule. */
function CompareSites() {
  const regular = [
    "צריך התאמות למסעדה",
    "אין קאנבן הזמנות חי",
    "אין מטבח בזמן אמת",
    "אין הזמנה חוזרת מובנית",
    "אין מועדון לקוחות למסעדות",
    "אין AI שמוסיף לעגלה",
    "אין ניהול משלוחים / איסוף / זמני הכנה כמו מסעדה",
  ];
  const quickfood = [
    "תפריט שנבנה לאוכל",
    "תוספות, גדלים, חצי-חצי, הערות למטבח",
    "הזמנות חיות בקאנבן",
    "דף תודה שמתעדכן בזמן אמת לפי סטטוס ההזמנה",
    "מסך מטבח והדפסה",
    "מועדון לקוחות, קופונים וקמפיינים",
    "AI להזמנות + משלוחים, איסוף עצמי, סניפים וזמני הכנה",
  ];
  return (
    <section id="compare" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>למה לא אתר רגיל</div>
        <h2 className={styles.sectionTitle}>
          לא WordPress. לא Shopify. <em>מערכת שנבנתה למסעדות.</em>
        </h2>
        <p className={styles.sectionLede}>
          אפשר לבנות אתר ב-WordPress, Shopify או Wix - אבל אז צריך להתאים הכל ידנית
          למסעדה. QuickFood כבר נבנתה לאוכל, לתפריט ולמטבח מהיום הראשון.
        </p>

        <div className={styles.compareGrid}>
          <div className={`${styles.compareCol} ${styles.compareColPlain}`}>
            <div className={styles.compareColHead}>אתר רגיל</div>
            <ul className={styles.compareList}>
              {regular.map((t) => (
                <li key={t}>
                  <X className={styles.compareIconNo} size={18} strokeWidth={2.4} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${styles.compareCol} ${styles.compareColUs}`}>
            <div className={styles.compareColHead}>QuickFood</div>
            <ul className={styles.compareList}>
              {quickfood.map((t) => (
                <li key={t}>
                  <Check className={styles.compareIconYes} size={18} strokeWidth={2.6} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
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
      "בערך 5 דקות. נרשמים, בוחרים צבעים ולוגו, מקלידים תפריט בסיסי, מחברים את חשבון התשלום - ויש לך כתובת לשתף בוואטסאפ. ליווי אישי בהקמה - חינם, פשוט תפנה אלינו.",
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
      "מייל - חינם ובלי הגבלה. וואטסאפ ו-SMS - חבילות שמתחילות מ-₪39, ונשלפות אוטומטית לאישור הזמנה, ׳יצא לדרך׳ ולבקשת ביקורת. הוואטסאפ עובד מהמספר שלך (דרך iBot Chat), לא ממספר משותף.",
    ],
    [
      "אוספים ביקורות אוטומטית?",
      "כן. שעה אחרי שהזמנה סומנה ׳נמסרה׳, הלקוח מקבל הודעה (וואטסאפ / SMS / מייל - אתה בוחר) עם לינק להשארת דירוג. הכוכבים מצטברים בדשבורד שלך, ואתה עונה על תגובות מאותו מסך.",
    ],
    [
      "אפשר לחבר לקופה הקיימת?",
      "כן. REST API מלא + Webhooks יוצאים על כל אירוע (הזמנה חדשה, שינוי סטטוס, יציאה לדרך, מסירה ועוד). כל מערכת שמדברת HTTP - קופה רושמת, מערכת ניהול, מלאי או הנהלת חשבונות - יכולה לקבל את האירועים בזמן אמת או לקרוא ישירות מה-API. אם אין מי שיכתוב את החיבור, אפשר לעבוד דרך Zapier או Make בלי שורת קוד.",
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
      "רוצה אפליקציה משלך? השירות שלנו מבוסס על API, אז הכל אפשרי - וגם לא כזה יקר. תשאיר לנו פרטים ונשלח לך הצעה מסודרת.",
    ],
    [
      "QuickFood מחליפה את אפליקציות המשלוחים?",
      "לא, ולא צריך. אפליקציות המשלוחים מצוינות להבאת לקוחות חדשים - תמשיך לעבוד איתן. QuickFood היא הערוץ הישיר שלך: כשהלקוח חוזר להזמין, הוא מזמין מהאתר הרשמי שלך - עם מועדון לקוחות, קופונים, QR והזמנה חוזרת בלחיצה - ולא דרך פלטפורמה.",
    ],
    [
      "כמה אני חוסך בעמלות?",
      "תלוי בכמה מהלקוחות החוזרים שלך עוברים להזמין ישירות. המערכת מציגה חיסכון משוער בלבד - אומדן, לא הבטחה - לפי הזמנות שנכנסו ישירות דרך האתר שלך. מקור הלקוח מבוסס על סריקות QR, קישורי קמפיין או דיווח עצמי של הלקוח; אנחנו לא יודעים מי הזמין אצלך בעבר דרך פלטפורמה חיצונית.",
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
        <a href="#" className={styles.brand} aria-label="QuickFood">
          <img
            src="/quickfood-mark-white.png"
            alt="QuickFood"
            width={48}
            height={48}
            className={styles.brandImg}
          />
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
      {/* Decorative b-roll on the visual-left of the hero. Horizontal
          gradient on ::after fades the right edge of the video into the
          yellow surface so there's no hard cut next to the headline.
          Auto-plays muted+looped, hidden on mobile to spare data. */}
      <div className={styles.heroMedia} aria-hidden="true">
        <video
          src="https://videos.pexels.com/video-files/33880845/14378437_360_640_24fps.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      </div>
      <div className={styles.container}>
        <h1 className={styles.headline}>
          <span className={styles.stack}>הלקוחות שלך.</span>
          <span className={styles.stack}>ההזמנות שלך.</span>
          <span className={styles.stack}>
            <Typewriter words={["הרווח שלך.", "הדאטה שלך.", "הצמיחה שלך.", "הקשר שלך."]} />
          </span>
        </h1>
        <p className={styles.headlineSmall}>
          QuickFood בונה למסעדה שלך אתר הזמנות רשמי וממותג - ומערכת צמיחה שמחזירה לקוחות להזמין ישירות ממך. בלי פורטל. בלי תלות. בלי לשלם עמלה גבוהה שוב ושוב על אותו לקוח.
        </p>
        <p className={styles.heroSecondary}>
          תמשיך לעבוד עם אפליקציות המשלוחים כדי להביא לקוחות חדשים. את הלקוחות שחוזרים - תחזיר אליך.
        </p>

        <div className={styles.heroCta}>
          <Link href="/signup" className={`${styles.btn} ${styles.btnTomato} ${styles.btnLg}`}>
            התחילו 7 ימים חינם
          </Link>
          <a
            href="#growth"
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostOutline} ${styles.btnLg}`}
          >
            בנו אתר הזמנות למסעדה <IcoArrowLeft c="currentColor" s={14} />
          </a>
        </div>

        <div className={styles.heroBadges}>
          <span className={styles.heroBadge}>אתר רשמי למסעדה</span>
          <span className={styles.heroBadge}>הזמנות ישירות</span>
          <span className={styles.heroBadge}>מועדון לקוחות</span>
          <span className={styles.heroBadge}>AI שמגדיל סל</span>
          <span className={styles.heroBadge}>קאנבן הזמנות חי</span>
          <span className={styles.heroBadge}>תשלומים והדפסה למטבח</span>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>₪299</div>
            <div className={styles.heroStatL}>לחודש. מחיר קבוע וברור.</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>0.5%</div>
            <div className={styles.heroStatL}>עמלת מערכת בלבד על הזמנות.</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>5 דק׳</div>
            <div className={styles.heroStatL}>מהרישום ועד אתר הזמנות פעיל.</div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── SUITED FOR (rotating food types) ──────────────────── */
function SuitedFor() {
  const types = [
    "פלאפלייה",
    "המבורגרייה",
    "סושייה",
    "שווארמייה",
    "פיצרייה",
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

/* ─── BORN FOR FOOD ──────────────────────────────────────────
   Merged section: the "5 דקות / how it works" onboarding promise
   folded into the "נולד למזון" food-first story, then proven with
   two real tablet shots in alternating image/text rows. Replaces the
   old HowItWorks + Math + ManageShowcase sections (page was too long). */
function BornForFood() {
  return (
    <section className={styles.section} id="manage">
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>האתר הרשמי שלך</div>
        <h2 className={styles.sectionTitle}>
          אתר הזמנות רשמי וממותג למסעדה. <em>הדומיין שלך, המותג שלך, הלקוחות שלך.</em>
        </h2>
        <p className={styles.sectionLede}>
          לא דף בפורטל של מישהו אחר - אתר הזמנות משלך עם הדומיין שלך, העיצוב שלך
          ודאטת הלקוחות שלך. מתחילים תוך 5 דקות, ומשם כל המסעדה מנוהלת ממסך אחד.
        </p>
        <div className={styles.bffSteps}>
          <span className={styles.bffStep}>הרשמה ב-2 דקות</span>
          <span className={styles.bffStep}>ייבוא תפריט מהיר ממקורות קיימים</span>
          <span className={styles.bffStep}>האתר עולה לאוויר על הדומיין שלך</span>
        </div>

        <div className={styles.bffRows}>
          <div className={styles.bffRow}>
            <figure className={styles.bffImgWrap}>
              <Image
                src="/showcase/dashboard.png"
                alt="דשבורד QuickFood - הכנסות, הזמנות ופריטים מובילים במבט אחד"
                width={1280}
                height={960}
                className={styles.manageImg}
              />
            </figure>
            <div className={styles.bffText}>
              <h3 className={styles.bffRowTitle}>כל המסעדה שלך. מסך אחד.</h3>
              <p className={styles.bffRowBody}>
                דשבורד שמראה הכל במבט - הכנסות, מספר הזמנות, ערך הזמנה ממוצע,
                זמן הכנה ממוצע, פריטים מובילים והזמנות לפי שעה. בלי אקסלים, בלי
                לנחש. אתה יודע בדיוק מה עובד ומתי.
              </p>
            </div>
          </div>

          <div className={styles.bffRow}>
            <div className={styles.bffText}>
              <h3 className={styles.bffRowTitle}>הזמנות חיות שזזות עם המטבח.</h3>
              <p className={styles.bffRowBody}>
                סטטוסים שאתה מכיר - חדשה, בהכנה, מוכן, יצא למשלוח. הסטטוס משתנה
                בלחיצה, מתעדכן ללקוח בזמן אמת, וזמן ההכנה מתארך אוטומטית בשעת
                עומס. לא &quot;processing&quot; של חברת שילוח - השפה של המטבח שלך.
              </p>
            </div>
            <figure className={styles.bffImgWrap}>
              <Image
                src="/showcase/live-orders.png"
                alt="לוח הזמנות חיות של QuickFood - ניהול הזמנות לפי שלבים"
                width={1280}
                height={960}
                className={styles.manageImg}
              />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PRINTER SHOWCASE ──────────────────────────────────── */
function PrinterShowcase() {
  return (
    <section id="printer" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מהאתר ישר למטבח</div>
        <h2 className={styles.sectionTitle}>
          הזמנה נכנסת באתר. <em>הקבלה כבר במטבח.</em>
        </h2>

        <div className={`${styles.qfoodCard} ${styles.qfoodCardMist} ${styles.printerCard}`}>
          <div className={styles.qfoodCardBody}>
            <span className={styles.qfoodCardTag}>חיבור מהיר למדפסות קבלות</span>
            <h3 className={styles.qfoodCardHeading}>
              מההזמנה באתר - ישר למדפסת.
            </h3>
            <p className={styles.printerLead}>
              קוויקפוד כבר מתממשקת עם המדפסת שיש לכם בעסק.
            </p>
            <p className={styles.qfoodCardCopy}>
              Star, Epson, מדפסת Bluetooth או כל מדפסת WiFi נתמכת - והמערכת
              מראה בדיוק מה להוריד ומה להגדיר. בוחר מדפסת. מחבר. מתחיל לעבוד.
            </p>
            <p className={styles.qfoodCardCopy}>
              מרגע החיבור, כל הזמנה שמתקבלת באתר מודפסת באופן מיידי עם כל
              הפרטים החשובים: פריטים, תוספות, הערות להזמנה וכתובת המשלוח.
            </p>
            <p className={styles.printerNoFuss}>
              בלי מחשב, בלי ראוטר, בלי התקנות מורכבות ובלי צורך בטכנאי.
            </p>
            <p className={styles.printerCaption}>
              בסרטון: חיבור חי בפיצרייה אמיתית - מהזמנה באתר ועד קבלה ביד.
            </p>
          </div>
          <div className={styles.printerVideoShell}>
            <LiteYouTube
              videoId="0kxe75kJ31o"
              title="חיבור מדפסת Star למערכת QuickFood בפיצרייה - הדגמה חיה"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PRODUCT SHOWCASE ──────────────────────────────────── */
/* ─── FEATURES ────────────────────────────────────────── */
/* Loyalty club - a flagship pillar, given its own full-width section right
   after the "manage" block so it lands before the feature firehose. The
   anchor card is the yellow `midnight` tone; the tier + mechanic cells reuse
   the mini-grid so the rhythm matches the rest of the page. */
function LoyaltyClub() {
  return (
    <section id="loyalty" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מועדון לקוחות</div>
        <h2 className={styles.sectionTitle}>
          מועדון הלקוחות הוא לא רק נקודות. <em>הוא הסיבה שלקוח חוזר אליך ישירות.</em>
        </h2>
        <p className={styles.sectionLede}>
          כל הזמנה ישירה מחזקת את הקשר עם הלקוח. QuickFood שומרת היסטוריית הזמנות,
          נקודות, דרגות, ימי הולדת והעדפות - כדי שהלקוח יחזור אליך, לא לפלטפורמה.
        </p>

        <div className={styles.qfoodStack}>
          <WoltCard
            tone="midnight"
            layout="decor-start"
            tag="חדש"
            heading="מועדון לקוחות שעובד לבד - כל שקל הופך לנקודה."
            body="כל מי שמזמין נכנס למעקב אוטומטית, צובר נקודות לפי כמה שקנה ומטפס במסלולים. טופס הצטרפות קופץ בכניסה לחנות, וצ׳קבוקס הצטרפות יושב בצ׳קאאוט - אתה מגדיר פעם אחת והמועדון רץ לבד."
            icon="crown"
          />
        </div>

        <div className={styles.miniGrid}>
          <MiniCell tag="סילבר" title="המסלול הראשון" body="כל לקוח חדש נכנס לסילבר ומתחיל לצבור מהשקל הראשון. בלי כרטיסיות, בלי אפליקציה." />
          <MiniCell tag="גולד" title="הקבועים שלך" body="חוצים את הסף ומטפסים לגולד אוטומטית. אתה רואה בדיוק מי הם ומה הם שווים לך." />
          <MiniCell tag="פלטינה" title="השגרירים" body="הלקוחות הכי שווים שלך, במסלול הגבוה. אלה שמחזירים את ההשקעה פי כמה." />
          <MiniCell tag="צבירה" title="כל שקל = נקודה" body="המנגנון הכי פשוט שיש. הנקודות נצברות לפי סכום הרכישות - בלי חישובים ובלי כאב ראש." />
          <MiniCell tag="הצטרפות" title="פופאפ בכניסה + צ׳קבוקס בצ׳קאאוט" body="שני ערוצי גיוס מובנים: טופס קופץ בכניסה לחנות, וסימון מהיר בסיום ההזמנה. מסמנים ומצטרפים." />
          <MiniCell tag="דיוור · בקרוב" title="הודעות ישר לחברי המועדון" body="דיוור ממוקד לפי מסלול - אימייל, SMS ווואטסאפ. נפתח בקרוב עם חבילות הדיוור." />
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מה מקבלים</div>
        <h2 className={styles.sectionTitle}>
          כלים שנבנו למטבח. <em>לא לחנות חולצות.</em>
        </h2>

        <div className={styles.qfoodStack}>
          <CustomizerWoltCard
            tag="התפריט"
            heading="תוספות, גדלים וחצי-חצי - בדיוק כמו שהמטבח שלך עובד."
            body="גדלים, קבוצות תוספות עם כללים ('2 חינם, השאר ב-₪4'), חצי-חצי והערות לטבח ('בלי בצל, חתוך ל-8'). המחיר מתעדכן אצל הלקוח בכל קליק - והקבלה אצלך מציינת בדיוק מה לא לשים."
          />

          <WoltCard
            tone="peach"
            layout="decor-start"
            tag="יועץ AI"
            heading="יועץ AI שמוכר בשבילך - פחות התלבטות, סל ממוצע גבוה יותר."
            body="הלקוח כותב 'ארוחה לזוג עד ₪120', 'משהו טבעוני', 'כמו בפעם שעברה' - והיועץ שואל, ממליץ, עושה Upsell ומוסיף לעגלה. פחות התלבטות. יותר הזמנות. סל ממוצע גבוה יותר."
            icon="sparkles"
          />

          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="הקבועים"
            heading="הוא הזמין אצלך פעם. עכשיו הוא יזמין שוב - בקליק."
            body="ההזמנה האחרונה, הכתובת, התוספות וההערות כבר מחכות לו. לוחץ פעם אחת - ומזמין שוב. הוא כבר מכיר אותך - אין סיבה שישלם בדרך עוד עמלות."
            icon="heart"
          />

          <WoltCard
            tone="lilac"
            layout="decor-end"
            tag="חיפוש ופילטרים"
            heading="טבעוני? חריף? בלי גלוטן? הלקוח מוצא בקליק."
            body="חיפוש חי בתפריט + 13 תגי תזונה: טבעוני, ללא גלוטן, כשר, חריף ועוד. מתייגים פעם אחת - והלקוח מסנן בקליק. בלי טלפונים ובלי שאלות."
            icon="leaf"
          />

          <WoltCard
            tone="peach"
            layout="decor-start"
            tag="תשלום"
            heading="Bit, אשראי, Apple Pay, פייבוקס, Google Pay - הכל נתמך בצ׳קאוט אחד."
            body="בשיתוף עם Grow Payments - כל אמצעי התשלום המובילים בצ׳קאוט אחד, בלי דפים חיצוניים. רוצים גם מזומן לשליח? מסמנים וזה שם. פשוט עובד."
            icon="wallet"
          />

          <WoltCard
            tone="lilac"
            layout="decor-end"
            tag="ביקורות"
            heading="הוא יקבל וואטסאפ. אתה תקבל את הכוכב החמישי."
            body="שעה אחרי המסירה יוצאת אוטומטית תזכורת לדרג - SMS, וואטסאפ או מייל. הכוכבים מצטברים בדשבורד, ואתה עונה מאותו מסך."
            icon="star"
          />

          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="וואטסאפ"
            heading="ההודעות מהמספר של העסק שלך. לא ממספר אנונימי שאף אחד לא מכיר."
            body="אישור הזמנה, ׳יצא לדרך׳, בקשת ביקורת - יוצאים אוטומטית מהמספר שלך. חבילות מ-₪39 לאלפי הודעות, מייל חינם בלי הגבלה. מחברים ומתחילים לעבוד."
            icon="chat"
          />

          <WoltCard
            tone="mist"
            layout="decor-end"
            tag="שליחים"
            heading="שליחים משלך. מסלול חי על המפה ללקוח."
            body="מקצים הזמנות לשליחים שלך - אוטומטית לפי אזור או בלחיצה. לכל שליח אפליקציה עם המסלול, וללקוח מפה חיה עם זמן הגעה מתעדכן. בלי לרענן, בלי להתקשר."
            icon="navigation"
          />

          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="צוות והרשאות"
            heading="לכל עובד יוזר משלו. כל אחד רואה רק את מה שצריך."
            body="לכל עובד יוזר ותפקיד משלו: מטבח נוחת על מסך המטבח, מנהל מקבל הכל חוץ מהכספים, בעלים שולט בכל. בלי לשתף סיסמאות, בלי להתעסק."
            icon="users"
          />
        </div>

        <div className={styles.miniGrid}>
          <MiniCell tag="שדרוג עגלה" title="מומלץ עבורך בסל הקניות" body="קרוסלת פריטים שמשלימים את ההזמנה בתוך סל הקניות - מבוססים על מה שבעגלה ועל לקוחות דומים. בלי לדחוף, בלי להציע פריט שכבר נבחר." />
          <MiniCell tag="משלוח" title="בוחר עיר או סניף - בקליק" body="צ׳יפ עם שם העיר במרכז דף הבית. לחיצה אחת - והתפריט והמחירים מתעדכנים לפי האזור." />
          <MiniCell tag="סניפים" title="מולטי-סניף" body="שעות, דמי משלוח, עמלת שירות ומינימום הזמנה נפרדים לכל סניף." />
          <MiniCell tag="קופונים" title="קופונים חכמים" body="לפי קטגוריה, סכום מינימום, מגבלת שימוש פר-לקוח, חלון תאריכים." />
          <MiniCell tag="מעקב" title="מעקב הזמנה חי" body="עדכון בזמן אמת ללקוח - בלי לרענן את המסך. אופציונלי לפי בחירה." />
          <MiniCell tag="תזמון" title="הזמנות מראש" body="הלקוח בוחר שעת מסירה או איסוף - 'תאסוף לי בשמונה' במקום 'בהקדם האפשרי'." />
          <MiniCell tag="אנליטיקה" title="נתונים אמיתיים" body="שעות שיא, פריטים מובילים, AOV, אחוז חזרה של לקוחות." />
          <MiniCell tag="חיבורים" title="Webhooks + REST" body="זפייר, Make, קופות רושמות וכל מערכת חיצונית שמדברת HTTP - מתחברות בלי כאב ראש." />
          <MiniCell tag="ייבוא" title="ייבוא תפריט מהיר ממקורות קיימים" body="מקבלים את הכל בקליק: קטגוריות, פריטים, תמונות, לוגו, שעות וכל קבוצות התוספות על הכללים שלהן. בישראל אפשר לייבא תפריט מ-Wolt בקליק; בשווקים אחרים מתאימים את הייבוא למקורות מקומיים." />
          <MiniCell tag="סכו״ם" title="סכו״ם חד-פעמי בקופה" body="הלקוח בוחר כמה סכו״ם הוא רוצה בקופה - אתה קובע מחיר ליחידה ומגדיר מעל איזה סכום זה חינם. אופציונלי, נשלט מהדשבורד." />
          <MiniCell tag="הודעות" title="הודעות חנות + אלרגנים" body="׳חסר היום: גבינת בופלו׳, התראת אלרגן על פריט - מנוהל מההגדרות ומופיע בחנות מיד." />
          <MiniCell tag="קמפיינים" title="פופאפ מבצע לחנות" body="מעלים תמונה + לינק, נפתח ללקוח ברגע שנכנס לחנות. דחיפה לליל שישי, מבצע חמישי-שישי, השקת פריט חדש - בלי לערוך תפריט." />
          <MiniCell tag="זמינות" title="פריט לפי שעה / יום / מלאי" body="ארוחות בוקר עד 11, עסקיות בין 14 ל-17, 20 יחידות והפריט נעלם להיום. הכל מתוזמן אוטומטית." />
        </div>
      </div>
    </section>
  );
}

/* Customizer-mockup variant of the wolt-card - used once, for the anchor
   "תוספות, גדלים, חצי-חצי" feature card. Lives in the same `.qfoodStack`
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
    <article className={`${styles.qfoodCard} ${styles.qfoodCardMidnight} ${styles.qfoodCardCustomizer}`}>
      <div className={styles.qfoodCardBody}>
        <div className={styles.qfoodCardTag}>{tag}</div>
        <h3 className={styles.qfoodCardHeading}>{heading}</h3>
        <p className={styles.qfoodCardCopy}>{body}</p>
      </div>
      <div className={styles.qfoodCardMockup}>
        <div className={styles.mockupAnnotation} aria-hidden>
          <span className={styles.mockupAnnotationText}>נסו ללחוץ - זה חי!</span>
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
    mist: styles.qfoodCardMist,
    sand: styles.qfoodCardSand,
    peach: styles.qfoodCardPeach,
    lilac: styles.qfoodCardLilac,
    midnight: styles.qfoodCardMidnight,
  }[tone];
  const layoutClass = {
    "decor-end": styles.qfoodCardDecorEnd,
    "decor-start": styles.qfoodCardDecorStart,
    wide: styles.qfoodCardWide,
  }[layout];
  const Icon = ICONS[icon];
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

/* ─── CUSTOMER SHOWCASE ─────────────────────────────────────
   Single live-customer card. Shows Pizza Ninja as a proof point
   right before the pricing section - "someone real is using this,
   with a real domain and real payments". */
function CustomerShowcase() {
  return (
    <section className={styles.section} id="customers">
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>סיפור הצלחה</div>
        <h2 className={styles.sectionTitle}>
          פיצה נינג׳ה. <em>מאפליקציות המשלוחים לאתר משלהם - תוך יום.</em>
        </h2>
        <p className={styles.sectionLede}>
          פיצה נינג׳ה היו על וולט. החליטו לפתוח ערוץ ישיר ללקוחות הקבועים שלהם - חיברו דומיין פרטי, הגדירו Grow Payments (אשראי, Bit, Apple Pay), ייבאו את התפריט המלא בקליק אחד.
        </p>

        <div className={styles.showcaseWrap}>
          <a
            href="/s/pizzaninja-gedera"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.showcaseCard}
          >
            {/* Browser URL bar */}
            <div className={styles.showcaseUrlBar}>
              <div className={styles.showcaseUrlDots}>
                <span style={{ background: "#FF5F57" }} />
                <span style={{ background: "#FEBC2E" }} />
                <span style={{ background: "#28C840" }} />
              </div>
              <div className={styles.showcaseUrlField}>
                <svg className={styles.showcaseUrlIcon} viewBox="0 0 16 16" fill="none" width={13} height={13} aria-hidden>
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className={styles.showcaseUrlText}>quickfood.co.il/s/pizzaninja-gedera</span>
                <span className={styles.showcaseLiveChip}>LIVE</span>
              </div>
            </div>

            {/* Card body */}
            <div className={styles.showcaseBody}>
              <div className={styles.showcaseBrand}>
                <div className={styles.showcaseLogoWrap} aria-hidden>
                  <Pizza strokeWidth={2} size={26} color="#000" />
                </div>
                <div>
                  <div className={styles.showcaseBrandName}>פיצה נינג׳ה</div>
                  <div className={styles.showcaseBrandDomain}>pizzaninja.co.il</div>
                </div>
              </div>

              <div className={styles.showcaseTags}>
                <span className={`${styles.showcaseTag} ${styles.showcaseTagGreen}`}>דומיין פרטי מחובר</span>
                <span className={`${styles.showcaseTag} ${styles.showcaseTagBlue}`}>Grow Payments פעיל</span>
                <span className={`${styles.showcaseTag} ${styles.showcaseTagBlue}`}>אשראי · Bit · Apple Pay</span>
                <span className={`${styles.showcaseTag} ${styles.showcaseTagYellow}`}>תפריט מוולט</span>
                <span className={`${styles.showcaseTag} ${styles.showcaseTagGreen}`}>שעות פתיחה מוגדרות</span>
                <span className={`${styles.showcaseTag} ${styles.showcaseTagGreen}`}>הכל פעיל</span>
              </div>

              <div className={styles.showcaseVisitRow}>
                <span className={styles.showcaseVisitLabel}>חנות דמו · פיצה נינג׳ה גדרה</span>
                <span className={styles.showcaseVisitBtn}>
                  לצפייה בחנות
                  <IcoArrowLeft c="currentColor" s={14} />
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── GROW PARTNER ──────────────────────────────────────────
   Preferred-provider announcement for Grow Payments. Frames the deal
   as a partnership benefit (better terms than going direct) while
   making it explicit that Grow is a third party and any other
   processor still works - we don't lock you in. */
function KioskSection() {
  return (
    <section id="kiosk" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>חדש · ממשק לעמדת קיוסק</div>
        <h2 className={styles.sectionTitle}>
          עמדת הזמנה עצמית. <em>הלקוח מזמין ומשלם לבד.</em>
        </h2>
        <p className={styles.sectionLede}>
          טאבלט בכניסה למסעדה הופך לעמדת קיוסק - אותו תפריט, אותו עיצוב, מסונכרן
          עם הדשבורד. הלקוחות מזמינים ומשלמים בלי תור ובלי טעויות, וההזמנה נכנסת
          ישר למטבח.
        </p>

        <div className={styles.kioskCard}>
          <div className={styles.kioskSplit}>
            <div className={styles.kioskVisual}>
              <Image
                src="/img/kiosk-tablet.png"
                alt="ממשק לעמדת קיוסק QuickFood על טאבלט"
                width={640}
                height={504}
                className={styles.kioskImg}
              />
            </div>

            <div className={styles.kioskContent}>
              <div className={styles.kioskGift}>
                <span className={styles.kioskGiftTag}>מתנה</span>
                <span className={styles.kioskGiftText}>
                  <strong>3 חודשים ללא עלות</strong> - מפעילים את הקיוסק בחשבון
                  שלכם, ומתנסים על חשבוננו.
                </span>
              </div>

              <ul className={styles.growList}>
                <li>
                  <strong>הזמנה עצמית בלי תור</strong>
                  <span>הלקוח בוחר, מתאים תוספות ומזמין לבד - הצוות מתפנה למטבח ולשירות במקום לרשום הזמנות.</span>
                </li>
                <li>
                  <strong>אותו תפריט, אותו עיצוב</strong>
                  <span>הקיוסק מסונכרן עם האתר והדשבורד - עדכנת מחיר או פריט? זה משתנה גם בעמדה, אוטומטית.</span>
                </li>
                <li>
                  <strong>מבצעים, באנדלים והגדלות מכירה</strong>
                  <span>שדרוגים ומבצעים אוטומטיים בעמדה - &quot;הגדל מנה&quot; או &quot;הוסף צ׳יפס ושתייה ב-19₪&quot; - מעלים את סכום ההזמנה הממוצע.</span>
                </li>
                <li>
                  <strong>תשלום בנייד בסריקת QR</strong>
                  <span>הלקוח סורק QR ומשלם מהנייד שלו - אשראי, Bit, Apple Pay ו-Google Pay. כל אחד משלם מהמכשיר שלו, בלי תור לקופה.</span>
                </li>
                <li>
                  <strong>גם מזומן - מסונכרן לקופה</strong>
                  <span>בחר לשלם במזומן? ההזמנה עוברת אוטומטית למסך הקופה שלנו ולמערכת ההזמנות - הכל מסונכרן, בלי רישום כפול.</span>
                </li>
                <li>
                  <strong>רץ על כל טאבלט</strong>
                  <span>בלי חומרה ייעודית ובלי התקנה - פותחים את הכתובת בטאבלט, וזהו. איפוס אוטומטי למסך הפתיחה אחרי חוסר פעילות.</span>
                </li>
                <li>
                  <strong>ישר לדשבורד ולמטבח</strong>
                  <span>כל הזמנה מהקיוסק נכנסת לאותו זרם הזמנות כמו האתר - אותה הדפסה למטבח, אותו מעקב חי.</span>
                </li>
              </ul>

              <a href="#talk" className={styles.kioskPopCta} style={{ alignSelf: "flex-start" }}>
                רוצה להפעיל קיוסק
              </a>
            </div>
          </div>

          <div className={styles.growFootnote}>
            <strong>חשוב לדעת:</strong> אנחנו מספקים את הממשק בלבד, לא את הציוד. אין
            צורך במחשב ייעודי, עמדה או מסופון - הקיוסק רץ על כל מכשיר מסך-מגע או
            טאבלט שכבר יש לכם.
          </div>
        </div>
      </div>
    </section>
  );
}

function GrowPartner() {
  return (
    <section id="grow" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>חדש · ספק סליקה מומלץ</div>
        <h2 className={styles.sectionTitle}>
          סליקה דרך Grow. <em>סנכרון מלא לדשבורד. בלי תוספות.</em>
        </h2>
        <p className={styles.sectionLede}>
          חברת הסליקה <strong>Grow</strong> מנהלת תשלומים ל-100,000 עסקים בישראל. דרך QuickFood היא מחוברת ישירות לדשבורד שלך - ביטולים, זיכויים, חשבוניות מס וכל אמצעי התשלום מסונכרנים אוטומטית, בלי לעבור בין מערכות.
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
                <strong>פייבוקס, ביט, Apple Pay, Google Pay</strong>
                <span>אמצעי תשלום שספקים אחרים גובים עליהם בנפרד או דורשים &quot;חבילת תוספים&quot; - אצל Grow הכל כלול בתעריף הבסיס. בלי הפעלה ידנית, בלי עמלה אחרת לכל אחד.</span>
              </li>
              <li>
                <strong>חשבוניות מס ללא הגבלה - כלולות במנוי</strong>
                <span>על כל הזמנה Grow מנפיקה חשבונית מס תקנית, שולחת ללקוח ומגישה לרשויות. בלי תקרת חודש, בלי תשלום נוסף, בלי חשבון נפרד אצל סולק חשבוניות.</span>
              </li>
              <li>
                <strong>תשלום מהיר לחשבון - תוך 24 שעות</strong>
                <span>יום עסקים אחד מההזמנה ועד שהכסף בבנק שלך. בלי תור, בלי תקרה יומית, בלי חודש המתנה כמו אצל סולקים מסורתיים.</span>
              </li>
              <li>
                <strong>חיבור בקליק אחד</strong>
                <span>נרשמים ל-Grow מתוך הדשבורד של QuickFood. ההתאמה הראשונית מסתיימת תוך דקות. מתחיל לסלוק היום למחר.</span>
              </li>
            </ul>
          </div>

          <div className={styles.growFootnote}>
            <strong>שקיפות מלאה:</strong> Grow היא חברת סליקה עצמאית - לא חברת-בת שלנו. אנחנו ממליצים עליה כספק מומלץ כי השגנו ללקוחות QuickFood אינטגרציה מלאה ותעריפים טובים. אבל <strong>אפשר לחבר כל חברת סליקה אחרת</strong> שעובדת איתך - Tranzila, CardCom, Pelecard, Isracard וכל מי שתומך ב-API סטנדרטי. הבחירה שלך, לא נועלים אותך.
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
    "יועץ AI בעברית (Claude / Gemini) - ממליץ ומוסיף לעגלה",
    "חיפוש בתפריט + 13 תגי תזונה (טבעוני, ללא גלוטן, כשר ועוד)",
    "מועדפים, הזמנה חוזרת חכמה ושדרוג עגלה אוטומטי",
    "זמן הכנה לכל פריט + זמן משוער מצרפי לכל הזמנה",
    "סטטוס מסעדה: פתוח / עומס / סגור - זמן הגעה משוער אוטומטי",
    "אתר שלם ממותג עם הדומיין שלך",
    "דשבורד ניהול הזמנות חי - תפריט ושליחים",
    "תשלומים - Bit, אשראי, Apple Pay, פייבוקס, Google Pay",
    "מעקב הזמנה חי + סטטוס בלייב",
    "ביקורות אוטומטיות עם תזכורת בוואטסאפ",
    "וואטסאפ מהמספר שלך (דרך iBot Chat)",
    "מייל ללא הגבלה - חינם",
    "אזורי משלוח עם זמן משלוח לכל אזור",
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
                  <small> + מע״מ.</small>
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
                  <strong>חבילות וואטסאפ + SMS החל מ-₪39.</strong>
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
            <a
              href="https://wa.me/972552554432?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%94%D7%92%D7%A2%D7%AA%D7%99%20%D7%9E%D7%90%D7%AA%D7%A8%20%D7%A7%D7%95%D7%95%D7%99%D7%A7%20%D7%A4%D7%95%D7%93%20%D7%95%D7%90%D7%A9%D7%9E%D7%97%20%D7%9C%D7%A7%D7%91%D7%9C%20%D7%A4%D7%A8%D7%98%D7%99%D7%9D"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.btn} ${styles.btnInk}`}
              style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <IcoWhatsApp c="currentColor" s={18} />
              WhatsApp לתמיכה
            </a>
          </div>

          <div>
            <details className={styles.faqItem} open>
              <summary>תוך כמה זמן אני באוויר?</summary>
              <p>
                בערך 5 דקות. נרשמים, בוחרים צבעים ולוגו, מקלידים תפריט בסיסי, מחברים את חשבון התשלום - ויש לך כתובת לשתף בוואטסאפ. ליווי אישי בהקמה - חינם, פשוט תפנה אלינו.
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
                מייל - חינם ובלי הגבלה. וואטסאפ ו-SMS - חבילות שמתחילות מ-₪39, ונשלפות אוטומטית לאישור הזמנה, ׳יצא לדרך׳ ולבקשת ביקורת. הוואטסאפ עובד מהמספר שלך (דרך iBot Chat), לא ממספר משותף.
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
                כן. REST API מלא + Webhooks יוצאים על כל אירוע (הזמנה חדשה, שינוי סטטוס, יציאה לדרך, מסירה ועוד). כל מערכת שמדברת HTTP - קופה רושמת, מערכת ניהול, מלאי או הנהלת חשבונות - יכולה לקבל את האירועים בזמן אמת או לקרוא ישירות מה-API. אם אין מי שיכתוב את החיבור, אפשר לעבוד דרך Zapier או Make בלי שורת קוד.
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
                רוצה אפליקציה משלך? השירות שלנו מבוסס על API, אז הכל אפשרי - וגם לא כזה יקר. תשאיר לנו פרטים ונשלח לך הצעה מסודרת.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>QuickFood מחליפה את אפליקציות המשלוחים?</summary>
              <p>
                לא, ולא צריך. אפליקציות המשלוחים מצוינות להבאת לקוחות חדשים - תמשיך לעבוד איתן. QuickFood היא הערוץ הישיר שלך: כשהלקוח חוזר להזמין, הוא מזמין מהאתר הרשמי שלך - עם מועדון לקוחות, קופונים, QR והזמנה חוזרת בלחיצה - ולא דרך פלטפורמה.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>כמה אני חוסך בעמלות?</summary>
              <p>
                תלוי בכמה מהלקוחות החוזרים שלך עוברים להזמין ישירות. המערכת מציגה חיסכון משוער בלבד - אומדן, לא הבטחה - לפי הזמנות שנכנסו ישירות דרך האתר שלך. מקור הלקוח מבוסס על סריקות QR, קישורי קמפיין או דיווח עצמי של הלקוח; אנחנו לא יודעים מי הזמין אצלך בעבר דרך פלטפורמה חיצונית.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── MID-PAGE CTA BAND ───────────────────────────────────
   The page got long after the positioning rebuild; this yellow
   band breaks the cream rhythm mid-scroll and gives a trial
   entry point before the visitor reaches pricing. */
function MidCta() {
  return (
    <section className={styles.midCta}>
      <div className={styles.container}>
        <div className={styles.midCtaInner}>
          <div className={styles.midCtaText}>
            <h2 className={styles.midCtaTitle}>
              מוכן להחזיר לקוחות להזמין ישירות ממך?
            </h2>
            <p className={styles.midCtaSub}>
              פותחים אתר הזמנות רשמי ומפעילים את מערכת הצמיחה ב-5 דקות. בלי
              התחייבות, בלי שיחת מכירה.
            </p>
            <div className={styles.midCtaChips}>
              <span className={styles.midCtaChip}>7 ימים חינם</span>
              <span className={styles.midCtaChip}>בלי כרטיס אשראי</span>
              <span className={styles.midCtaChip}>בלי התחייבות</span>
            </div>
          </div>
          <div className={styles.midCtaActions}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnInk} ${styles.btnLg}`}>
              התחילו 7 ימים חינם <IcoArrowLeft c="currentColor" s={14} />
            </Link>
            <a
              href="#talk"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostOutline} ${styles.btnLg}`}
            >
              נדבר קודם
            </a>
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
              5 דקות. <em>וזה כבר שלך.</em>
            </h2>
            <p>
              תפתח חנות, תקבל הזמנה אחת, ותראה איך זה מרגיש כשהמנה הולכת ישר מהמטבח שלך ללקוח שלך - עם השם שלך בלבד.
            </p>
            <div className={styles.finalCtaActions}>
              <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnInk}`}>
                התחילו 7 ימים חינם <IcoArrowLeft c="currentColor" s={14} />
              </Link>
              <span className={styles.finalCtaDivider}>או</span>
              <a href="#talk" className={`${styles.btn} ${styles.btnLg} ${styles.btnGhost} ${styles.btnGhostOutline}`}>
                נדבר קודם <IcoArrowLeft c="currentColor" s={14} />
              </a>
            </div>
            <p className={styles.finalCtaNote}>בלי כרטיס אשראי. בלי התחייבות.</p>
          </div>
        </div>

        <div id="talk" className={styles.leadFormWrap}>
          <LeadForm
            source="landing"
            heading="עדיין מתלבט? נדבר."
            subheading="השאר פרטים ונחזור אליך תוך יום עבודה. בלי שיחת מכירה אגרסיבית - שאלות, הדגמה קצרה, וזהו."
            submitLabel="שלחו לי פרטים"
          />
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
              <small>BY QUICKSHOP</small>
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
            <Link href="/about">אודות</Link>
            <Link href="/blog">בלוג</Link>
            <Link href="/careers">קריירה</Link>
            <Link href="/contact">צור קשר</Link>
          </div>
          <div className={styles.footCol}>
            <h5>מסמכים</h5>
            <Link href="/terms">תנאי שימוש</Link>
            <Link href="/privacy">פרטיות</Link>
            <a
              href="https://quick-accessibility.vercel.app/s/5ezqwew2ypzj38js"
              target="_blank"
              rel="noopener noreferrer"
            >
              מדיניות הנגשה
            </a>
            <Link href="/sla">SLA</Link>
            <Link href="/status">סטטוס מערכת</Link>
            <Link href="/docs/pos">API Docs</Link>
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
