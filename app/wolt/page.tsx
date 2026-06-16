import type { Metadata } from "next";
import Link from "next/link";
import { Rubik, JetBrains_Mono } from "next/font/google";
import { IcoArrowLeft } from "@/components/shared/Icons";
import { LeadForm } from "@/components/marketing/LeadForm";
import { WhatsAppFAB } from "../_components/WhatsAppFAB";
import ScrollAnimations from "../_components/ScrollAnimations";
import {
  LayoutGrid,
  RefreshCw,
  ChefHat,
  BarChart3,
  Store,
  Plug,
  Bell,
  Layers,
  ShoppingBag,
  ArrowLeft,
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
  title: "QuickFood + Wolt - כל ההזמנות במסך אחד | חיבור רשמי לוולט",
  description:
    "QuickFood מאחדת את ההזמנות מוולט, מהאתר שלך ומכל ערוץ אחר למסך אחד ולמטבח אחד. הזמנת וולט נכנסת ישר ללוח ההזמנות שלך, ווולט מתעדכן לבד. סוף לקפיצה בין טאבלטים.",
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
      "הזמנות וולט נכנסות ישר ללוח ההזמנות ולמטבח שלך, לצד ההזמנות מהאתר שלך. ווולט מתעדכן לבד. מסך אחד לכל הערוצים.",
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

const INK = "#111111";
const WOLT_BLUE = "#00C2E8";

/* Flow diagram: Wolt order -> your board -> kitchen -> status back to Wolt.
   Horizontal on desktop (RTL, arrows point left), stacked on mobile. */
function FlowDiagram() {
  const nodes: { Icon: LucideIcon; title: string; sub: string; accent?: boolean; split?: boolean }[] = [
    { Icon: ShoppingBag, title: "הזמנה מ-Wolt", sub: "לקוח מזמין ב-Wolt", accent: true },
    { Icon: LayoutGrid, title: "הלוח שלך", sub: "נכנסת ללוח ההזמנות אוטומטית", split: true },
    { Icon: ChefHat, title: "המטבח", sub: "יוצאת להכנה כמו כל הזמנה" },
    { Icon: RefreshCw, title: "Wolt מתעדכן לבד", sub: "הלקוח של Wolt מעודכן בזמן אמת", accent: true },
  ];
  const iconBg = (n: { accent?: boolean; split?: boolean }) =>
    n.split
      ? `linear-gradient(135deg, #F5C84B 0%, #F5C84B 50%, ${WOLT_BLUE} 50%, ${WOLT_BLUE} 100%)`
      : n.accent
        ? WOLT_BLUE
        : "#F5C84B";
  return (
    <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-2 mt-8">
      {nodes.map((n, i) => (
        <div key={n.title} className="flex flex-col sm:flex-row items-center sm:items-stretch gap-3 sm:gap-2">
          <div
            className="flex-1 w-full sm:w-44 self-stretch rounded-2xl bg-white p-4 text-center flex flex-col justify-center"
            style={{ border: `2px solid ${INK}`, boxShadow: `0 5px 0 ${INK}` }}
          >
            <div
              className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center mb-2"
              style={{
                background: iconBg(n),
                border: `2px solid ${INK}`,
              }}
            >
              <n.Icon size={20} strokeWidth={2.2} color={INK} />
            </div>
            <div className="font-extrabold text-black text-sm">{n.title}</div>
            <div className="text-[11px] text-black/55 mt-0.5 leading-snug">{n.sub}</div>
          </div>
          {i < nodes.length - 1 && (
            <span
              className={styles.flowArrow}
              style={{ animationDelay: `${i * 0.2}s`, alignSelf: "center" }}
              aria-hidden
            >
              <ArrowLeft
                size={22}
                strokeWidth={2.6}
                color={INK}
                className="shrink-0 -rotate-90 sm:rotate-0"
              />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* Mockup of the unified Kanban: a Wolt order card next to a direct
   (your-site) order card on the same board. Illustrative only. */
function BoardMockup() {
  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div
        className="rounded-2xl bg-white overflow-hidden"
        style={{ border: `2px solid ${INK}`, boxShadow: `0 6px 0 ${INK}` }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: "#F5C84B", borderBottom: `2px solid ${INK}` }}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: INK, opacity: 0.85 }} />
          <span className="w-3 h-3 rounded-full" style={{ background: INK, opacity: 0.5 }} />
          <span className="w-3 h-3 rounded-full" style={{ background: INK, opacity: 0.25 }} />
          <span className="font-extrabold text-black text-sm ms-2">הזמנות פעילות</span>
          <span className="relative flex w-2.5 h-2.5 ms-1" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-green-500" style={{ border: "1.5px solid rgba(0,0,0,0.25)" }} />
          </span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-black/55">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            חי
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 p-4" style={{ background: "#FAF6EA" }}>
          <OrderCard
            channel="Wolt"
            channelBg={WOLT_BLUE}
            number="W-2381"
            customer="דניאל כהן"
            items="פיצה משפחתית ×1 · קולה זירו ×2"
            status="חדשה"
            price="₪96"
          />
          <OrderCard
            channel="האתר שלך"
            channelBg={INK}
            number="PV-1043"
            customer="מאיה לוי"
            items="פיצה ביאנקה ×1 · תוספת גבינה"
            status="בהכנה"
            price="₪74"
          />
        </div>
      </div>
      <p className="text-center text-[11px] text-black/45 mt-2">להמחשה - Wolt והאתר שלך על אותו לוח, אותו מטבח.</p>
    </div>
  );
}

function OrderCard({
  channel,
  channelBg,
  number,
  customer,
  items,
  status,
  price,
}: {
  channel: string;
  channelBg: string;
  number: string;
  customer: string;
  items: string;
  status: string;
  price: string;
}) {
  return (
    <div
      className="rounded-xl bg-white p-3.5 text-right"
      style={{ border: `2px solid ${INK}`, boxShadow: `0 3px 0 ${INK}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[11px] font-extrabold px-2 py-0.5 rounded-md text-white"
          style={{ background: channelBg }}
        >
          {channel}
        </span>
        <span className="text-xs font-bold text-black/50 tnum" dir="ltr">
          #{number}
        </span>
      </div>
      <div className="font-bold text-black text-sm">{customer}</div>
      <div className="text-xs text-black/55 leading-relaxed mt-0.5 mb-2.5">{items}</div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-black/70">
          <span className="w-2 h-2 rounded-full" style={{ background: "#F5C84B", border: `1.5px solid ${INK}` }} />
          {status}
        </span>
        <span className="font-extrabold text-black tnum">{price}</span>
      </div>
    </div>
  );
}

export default function WoltLandingPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${mono.variable}`}>
      <Nav />

      {/* ── HERO ── */}
      <header className={styles.hero}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot}>בקרוב</span>
            החיבור הרשמי של QuickFood ל-Wolt
          </div>
          <h1 className={styles.headline}>
            <span className={styles.stack}>כל ההזמנות שלך.</span>
            <span className={styles.stack}>מסך אחד.</span>
            <span className={styles.stack}>
              <em>אפס כאב ראש.</em>
            </span>
          </h1>
          <p className={styles.headlineSmall} style={{ marginInline: "auto" }}>
            כל הזמנה מ-Wolt נכנסת אוטומטית ללוח של QuickFood, יחד עם ההזמנות מהאתר שלך.
            המטבח עובד ממקום אחד, Wolt מתעדכן לבד, ואתה מפסיק לקפוץ בין מסכים.
          </p>
          <p className={styles.headlineSmall} style={{ marginInline: "auto", fontWeight: 700 }}>
            בלי טאבלט נוסף. בלי להקליד הזמנות מחדש. בלי לקפוץ בין מסכים. פשוט עובדים מתוך QuickFood.
          </p>

          <div className={styles.heroCta} style={{ justifyContent: "center" }}>
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
              <div className={styles.heroStatN}>לוח אחד</div>
              <div className={styles.heroStatL}>כל ההזמנות במקום אחד.</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatN}>זמן אמת</div>
              <div className={styles.heroStatL}>כל הזמנה נכנסת מיד ללוח.</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatN}>בלי טאבלט</div>
              <div className={styles.heroStatL}>עובדים רק על QuickFood.</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── BOARD MOCKUP ── */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <BoardMockup />
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section className={styles.section}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <div className={styles.sectionEyebrow}>המצב היום</div>
          <h2 className={styles.sectionTitle} style={{ marginInline: "auto" }}>
            יש לך רק מטבח אחד. <em>אז למה לנהל כמה מסכים?</em>
          </h2>
          <p className={styles.headlineSmall} style={{ marginInline: "auto" }}>
            הזמנות מ-Wolt, הזמנות מהאתר, כל הזמנה מגיעה ממקום אחר, הצוות קופץ בין מסכים,
            ובשעות הלחץ קל לפספס. QuickFood מרכזת את כל ההזמנות ללוח אחד, כדי שכל הצוות
            יעבוד מאותו מקום.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className={styles.section}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <div className={styles.sectionEyebrow}>איך זה עובד</div>
          <h2 className={styles.sectionTitle} style={{ marginInline: "auto" }}>
            הזמנה מ-Wolt. <em>אצלך בדשבורד.</em>
          </h2>
          <FlowDiagram />
          <div className={styles.qfoodStack}>
            <StepCard
              n="1"
              Icon={Plug}
              title="מחברים את Wolt פעם אחת."
              body="לחיצה אחת בדשבורד מחברת את חשבון ה-Wolt שלך ל-QuickFood. חיבור רשמי ומאובטח, בלי סיסמאות משותפות ובלי טאבלט נוסף."
            />
            <StepCard
              n="2"
              Icon={LayoutGrid}
              title="ההזמנה נכנסת ישר ללוח שלך."
              body="כל הזמנה מ-Wolt מופיעה לבד בלוח ההזמנות ובמטבח, לצד ההזמנות מהאתר שלך. אותם פריטים, אותו צוות, בלי להקליד כלום."
            />
            <StepCard
              n="3"
              Icon={RefreshCw}
              title="אתה עובד ב-QuickFood. Wolt כבר מסתדר לבד."
              body="מקבל את ההזמנה ומכין אותה כמו תמיד. Wolt מתעדכן מעצמו, הלקוח שם רואה מה קורה, ואתה לא נוגע בטאבלט."
            />
          </div>
        </div>
      </section>

      {/* ── HIGHLIGHTS ── */}
      <section className={styles.section}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <div className={styles.sectionEyebrow}>מה מקבלים</div>
          <h2 className={styles.sectionTitle} style={{ marginInline: "auto" }}>
            עוד ערוץ מכירה. <em>בלי עוד כאב ראש.</em>
          </h2>
          <div className={styles.qfoodStack}>
            <FeatureCard
              tone="mist"
              layout="decor-end"
              Icon={LayoutGrid}
              tag="לוח מאוחד"
              heading="כל ההזמנות בלוח אחד - Wolt והאתר שלך יחד."
              body="הזמנות Wolt מסומנות בבירור על אותו לוח שאתה כבר מכיר. בלי מסך נפרד, בלי להחליט כל פעם איפה להסתכל."
            />
            <FeatureCard
              tone="sand"
              layout="decor-start"
              Icon={ChefHat}
              tag="מסך מטבח"
              heading="המטבח רואה הכל במקום אחד."
              body="הזמנת Wolt נכנסת למסך המטבח כמו כל הזמנה אחרת - אותם פריטים, אותן הערות, אותו זמן הכנה. הצוות לא לומד מערכת חדשה."
            />
            <FeatureCard
              tone="peach"
              layout="decor-end"
              Icon={Bell}
              tag="עדכון אוטומטי"
              heading="Wolt מתעדכן לבד, בלי לגעת בטאבלט."
              body="אתה עובד רק במערכת אחת, ו-Wolt מתעדכן מעצמו. בלי לעבוד פעמיים על אותה הזמנה, בלי לשכוח."
            />
            <FeatureCard
              tone="lilac"
              layout="decor-start"
              Icon={Layers}
              tag="תפריט אחד"
              heading="לא צריך לנהל שני תפריטים."
              body="הזמנת Wolt מתחברת לפריטים שכבר במערכת שלך, כך שהדוחות והמלאי מדויקים על כל ההזמנות - מכל הערוצים."
            />
            <FeatureCard
              tone="sand"
              layout="decor-end"
              Icon={BarChart3}
              tag="דוחות במקום אחד"
              heading="כמה מגיע מ-Wolt, כמה ישירות - במבט אחד."
              body="הכנסות, מספר הזמנות ושעות העומס - לכל ערוץ בנפרד ולכולם יחד. תמונה אחת אמיתית של העסק, בלי לאסוף נתונים מכמה מקומות."
            />
            <FeatureCard
              tone="peach"
              layout="decor-start"
              Icon={Store}
              tag="האתר שלך במרכז"
              heading="האתר שלך נשאר הבית."
              body="Wolt מביא לקוחות חדשים. האתר שלך בונה את העסק שלך. QuickFood מאפשרת לנהל את שניהם מאותו מקום."
            />
          </div>

          <div className={styles.miniGrid}>
            <MiniCell tag="התראות" title="צליל לכל הזמנה חדשה" body="הזמנת Wolt מצלצלת כמו כל הזמנה - הצוות יודע מיד, בלי לבהות בטאבלט." />
            <MiniCell tag="קבלות" title="הדפסה אוטומטית למטבח" body="הזמנת Wolt יוצאת למדפסת או למסך המטבח בדיוק כמו הזמנה מהאתר שלך." />
            <MiniCell tag="היסטוריה" title="הכל בהיסטוריה אחת" body="חיפוש, סינון ודוחות על כל ההזמנות - Wolt והאתר - מאותו מסך." />
            <MiniCell tag="ללא הקלדה" title="סוף להקלדה ידנית" body="ההזמנה נכנסת מלאה ומדויקת - פריטים, תוספות והערות - בלי להקליד מחדש." />
            <MiniCell tag="אמין" title="חיבור רשמי ומאובטח" body="חיבור רשמי מול Wolt, בלי סיסמאות משותפות ובלי פתרונות עוקפים." />
            <MiniCell tag="ערוצים נוספים" title="בנוי לעוד ערוצים" body="בעתיד נחבר גם ערוצי משלוח נוספים - אותו לוח, אותו מטבח." />
          </div>
        </div>
      </section>

      {/* ── PARTNER NOT COMPETITOR ── */}
      <section className={styles.section}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <div className={styles.sectionEyebrow}>שותף, לא מתחרה</div>
          <h2 className={styles.sectionTitle} style={{ marginInline: "auto" }}>
            Wolt ו-QuickFood <em>עובדות ביחד.</em>
          </h2>
          <p className={styles.headlineSmall} style={{ marginInline: "auto" }}>
            אתה לא צריך לבחור בין Wolt להזמנות ישירות. Wolt מביא לקוחות חדשים, האתר שלך מגדיל
            את הרווחיות, ו-QuickFood מרכזת את הכל למסך אחד.
          </p>
          <p
            className={styles.headlineSmall}
            style={{ marginInline: "auto", fontWeight: 800, color: "var(--ink)" }}
          >
            מהיום אתם לא מנהלים את Wolt ואת האתר שלכם. אתם פשוט מנהלים את המסעדה.
          </p>
        </div>
      </section>

      {/* ── JOIN ── */}
      <section className={styles.finalCta}>
        <div className={styles.container} style={{ textAlign: "center" }}>
          <div className={styles.finalCtaCard}>
            <div className={styles.finalCtaBody}>
              <span className={styles.finalCtaTag}>גישה מוקדמת</span>
              <h2>
                תהיו בין המסעדות הראשונות <em>שמנהלות גם את Wolt וגם את האתר ממסך אחד.</em>
              </h2>
              <p>
                אנחנו משיקים את החיבור הרשמי ל-Wolt בקרוב. השאר פרטים ונחבר אותך ברגע שזה עולה -
                ליווי אישי בהקמה, בלי התעסקות.
              </p>
            </div>
          </div>

          <div id="join" className={styles.leadFormWrap}>
            <LeadForm
              source="wolt"
              heading="הצטרפו לגישה המוקדמת"
              subheading="השאר פרטים ונעדכן אותך ברגע שהחיבור ל-Wolt פתוח לחנות שלך. בלי שיחת מכירה אגרסיבית."
              submitLabel="שמרו לי מקום"
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.container} style={{ textAlign: "center" }}>
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
