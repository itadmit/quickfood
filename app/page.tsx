import type { Metadata } from "next";
import { Rubik, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { IcoArrowLeft } from "@/components/shared/Icons";
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
  title: "QuickFood — אפליקציית הזמנות עצמאית למסעדות",
  description:
    "פיצרייה, שווארמייה, המבורגרייה או סושייה — חנות אונליין משלך, בעיצוב שלך, בלי לחלוק עם החברות הגדולות. ₪299 לחודש + 0.5% להזמנה. 7 ימים על חשבוננו.",
};

export default function LandingPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${mono.variable}`}>
      <Nav />
      <Hero />
      <Math />
      <Features />
      <Showcase />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
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
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot}>חדש</span>
          לפיצרייה, שווארמייה, המבורגרייה, סושייה — ולכל מי שמכין אוכל ומוסר אותו
        </div>

        <h1 className={styles.headline}>
          <span className={styles.stack}>הלקוחות שלך.</span>
          <span className={styles.stack}>ההזמנות שלך.</span>
          <span className={styles.stack}><em>הכסף שלך.</em></span>
          <span className={styles.headlineSmall}>
            חנות אונליין משלך, בעיצוב שלך, על דומיין משלך. בלי לחלוק עם החברות הגדולות את השליש שאתה מרוויח על כל פיצה.
          </span>
        </h1>

        <div className={styles.heroMeta}>
          <div className={styles.heroCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnTomato} ${styles.btnLg}`}>
              QuickFood, פתח לי חנות
            </Link>
            <a
              href="#pricing"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostOutline} ${styles.btnLg}`}
            >
              כמה זה עולה <IcoArrowLeft c="currentColor" s={14} />
            </a>
          </div>
          <div className={styles.heroStats}>
            <div>
              <div className={styles.heroStatN}>₪299</div>
              <div className={styles.heroStatL}>לחודש. נעול לכל החיים</div>
            </div>
            <div>
              <div className={styles.heroStatN}>0.5%</div>
              <div className={styles.heroStatL}>פר הזמנה. לא שלושים</div>
            </div>
            <div>
              <div className={styles.heroStatN}>11 דק׳</div>
              <div className={styles.heroStatL}>מהרישום ועד חנות חיה</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── MATH (the comparison) ──────────────────────────────── */
function Math() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>המתמטיקה</div>
        <h2 className={styles.sectionTitle}>
          הלקוח שילם 100 שקל. <em>למי הולך השליש?</em>
        </h2>

        <div className={styles.problemGrid}>
          <div className={`${styles.problemCard} ${styles.problemCardPeach}`}>
            <div className={styles.problemNum}>הפורטלים</div>
            <h3>30 שקל הולכים להם.</h3>
            <p>
              החברות הגדולות שמרכזות מסעדות גובות שליש מכל הזמנה. בנוסף תשלם להן בשביל להופיע ראשון, ולקבל לוגו רגיל, ולקבל פוש להזמנה הבאה. הלקוחות, אגב, שלהן.
            </p>
          </div>
          <div className={`${styles.problemCard} ${styles.problemCardMist}`}>
            <div className={styles.problemNum}>QuickFood</div>
            <h3>חצי שקל. ואפס שטויות.</h3>
            <p>
              ₪299 לחודש על הפלטפורמה (נעול לכל החיים), פלוס חצי אחוז עמלת סליקה לכל הזמנה. כל השאר נשאר אצלך. הלקוחות, ההיסטוריה, הצבעים, הלוגו — שלך.
            </p>
          </div>
          <div className={`${styles.problemCard} ${styles.problemCardLilac}`}>
            <div className={styles.problemNum}>בסוף חודש</div>
            <h3>1,000 הזמנות = ₪5,000 בכיס.</h3>
            <p>
              אצלם 1,000 הזמנות של ₪100 = ₪30,000 ירדו לך. אצלנו אותן אלף הזמנות = ₪500 עמלת סליקה. ההפרש קונה לך חודש שלם של תוכנית עם תוספת של חמש כפול חמש.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PRODUCT SHOWCASE ──────────────────────────────────── */
function Showcase() {
  return (
    <section id="product" className={`${styles.section} ${styles.showcase}`}>
      <div className={styles.container}>
        <div className={styles.showcaseHead}>
          <div>
            <div className={`${styles.sectionEyebrow} ${styles.sectionEyebrowBasil}`}>המוצר</div>
            <h2 className={styles.sectionTitle}>שני צדדים. <em>אותו סיפור.</em></h2>
          </div>
          <p className={styles.sectionLede}>
            אפליקציה שהלקוח מרגיש בה כמו בגדולות, ודשבורד שגם עובד המשמרת מצליח לתפעל. הכל מוכן מהיום הראשון — בלי טכנאי, בלי הגדרות, בלי כאב ראש.
          </p>
        </div>

        <div className={styles.showcaseGrid}>
          <div className={`${styles.showcaseCard} ${styles.showcaseCardDark}`}>
            <div className={styles.showcaseTag}>הדשבורד שלך</div>
            <h3>קופיט אחד. כל מה שקורה במסעדה.</h3>
            <p>הזמנות חדשות מקפיצות לקנבן, אתה לוחץ ׳מתחילים׳, הלקוח כבר מקבל וואטסאפ. סטטוסים, שליחים, תפריט, ניתוחי מכירות — הכל כאן. עובד גם על טאבלט שעומד ליד הקופה.</p>
            <div className={styles.showcaseFeatures}>
              <span className={styles.featChip}>קנבן הזמנות</span>
              <span className={styles.featChip}>תפריט drag-n-drop</span>
              <span className={styles.featChip}>7 ערכות צבע</span>
              <span className={styles.featChip}>RTL מלא</span>
              <span className={styles.featChip}>מולטי-סניף</span>
            </div>

            <div className={styles.miniDashKpis}>
              <div className={styles.miniDashRow}>
                <div className={`${styles.miniDashCell} ${styles.miniDashCellRed}`}>
                  <div className={styles.miniDashLabel}>חדשות</div>
                  <div className={styles.miniDashValue}>2</div>
                </div>
                <div className={`${styles.miniDashCell} ${styles.miniDashCellYellow}`}>
                  <div className={styles.miniDashLabel}>בהכנה</div>
                  <div className={styles.miniDashValue}>4</div>
                </div>
                <div className={`${styles.miniDashCell} ${styles.miniDashCellGreen}`}>
                  <div className={styles.miniDashLabel}>מוכן</div>
                  <div className={styles.miniDashValue}>3</div>
                </div>
                <div className={`${styles.miniDashCell} ${styles.miniDashCellMuted}`}>
                  <div className={styles.miniDashLabel}>במשלוח</div>
                  <div className={styles.miniDashValue}>5</div>
                </div>
              </div>
              <div className={styles.miniDashHint}>
                <span className="inline-flex items-center gap-1">
                  קליק לפתיחת הדמו
                  <IcoArrowLeft c="currentColor" s={12} />
                </span>
              </div>
            </div>
          </div>

          <div className={styles.showcaseCard}>
            <div className={styles.showcaseTag}>הלקוח שלך</div>
            <h3>חוויה שמרגישה כמו הגדולים. רק שלך.</h3>
            <p>אפליקציה מהירה, צבעים שלך, לוגו שלך. לא עוד שורה ברשימה של פורטל. הלקוח חוזר ישר לכתובת שלך, לא דרך אף אחד אחר.</p>

            <div className={styles.phoneMock}>
              <div className={styles.phoneScreen}>
                <div className={styles.phoneStatus}><span>9:41</span><span>●●●</span></div>
                <div className={styles.phoneHeaderCard}>
                  <div className={styles.phoneLoc}>משלוח אל</div>
                  <div className={styles.phoneAddr}>אלנבי 42, ת״א</div>
                  <div className={styles.phoneSearch}>חיפוש פיצה, תוספת...</div>
                </div>
                <div className={styles.phonePromo}>
                  <b>שעת הבצק</b>
                  <span>1+1 על קלאסיות עד 19:00</span>
                </div>
                <div className={styles.phoneItem}>
                  <div className={styles.phoneItemImg}>
                    <Image src="/img/landing/pizza-margherita.jpg" alt="" fill sizes="44px" />
                  </div>
                  <div className={styles.phoneItemInfo}>
                    <div className={styles.phoneItemName}>מרגריטה</div>
                    <div className={styles.phoneItemDesc}>מוצרלה, בזיליקום</div>
                  </div>
                  <div className={styles.phoneItemPrice}>₪58</div>
                </div>
                <div className={styles.phoneItem}>
                  <div className={styles.phoneItemImg}>
                    <Image src="/img/landing/pizza-cheese.jpg" alt="" fill sizes="44px" />
                  </div>
                  <div className={styles.phoneItemInfo}>
                    <div className={styles.phoneItemName}>4 גבינות</div>
                    <div className={styles.phoneItemDesc}>גורגונזולה, פרמז&apos;ן</div>
                  </div>
                  <div className={styles.phoneItemPrice}>₪72</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURES ────────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>מה מקבלים</div>
        <h2 className={styles.sectionTitle}>
          כל מה שצריך כדי למכור. <em>בלי שום דבר שלא.</em>
        </h2>

        <div className={styles.woltStack}>
          <WoltCard
            tone="mist"
            layout="decor-end"
            tag="חנות"
            heading="האפליקציה שלך, לא הרשימה של מישהו אחר."
            body="לוגו שלך, צבעים שלך, שם שלך, דומיין משלך (order.השם.co.il). הלקוח לא רואה אותנו ולא רואה אף אחד אחר. רק אותך."
            decor="◐"
          />

          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="תשלום"
            heading="Bit, אשראי, Apple Pay, Google Pay — באותו מסך."
            body="הלקוח לוחץ ׳שלם׳ בתוך החנות, ארנק התשלום נפתח לידו, מקיש PIN ב-Bit או טבעת אצבע ב-Apple Pay — והכסף בחשבון תוך 24 שעות. בלי הפניות, בלי iframe מוזר."
            decor="◑"
          />

          <WoltCard
            tone="peach"
            layout="decor-end"
            tag="ביקורות"
            heading="הוא יקבל וואטסאפ. אתה תקבל את הכוכב החמישי."
            body="שעה אחרי המסירה, אנחנו שולחים לו לבד תזכורת לדרג. SMS, וואטסאפ או מייל — אתה בוחר. הכוכבים מצטברים בדשבורד שלך, ואתה עונה מאותו מסך."
            decor="◒"
          />

          <WoltCard
            tone="lilac"
            layout="decor-start"
            tag="מעקב"
            heading="הוא רואה איפה ההזמנה. אתה רואה איפה הוא."
            body="התקבלה ← בהכנה ← מוכנה ← בדרך, עדכון חי בלי לרענן. אפשר להציג ETA לדקה או רק לכתוב ׳תודה׳ — לבחירתך. עוזר להפחית טלפונים של ׳עוד כמה זמן?׳."
            decor="◓"
          />

          <WoltCard
            tone="sand"
            layout="decor-end"
            tag="וואטסאפ"
            heading="ההודעות מהמספר שלך. לא מאיזה +1."
            body="חיבור אישי ל-iBot Chat. אישור הזמנה, יצא לדרך, בקשת ביקורת — אוטומטית מהמספר של החנות. חבילות מ-₪39 לאלפי הודעות. מייל ללא הגבלה, חינם."
            decor="◔"
          />

          <WoltCard
            tone="midnight"
            layout="decor-end"
            tag="העלות האמיתית"
            heading="₪299 לחודש. נעול. לכל החיים."
            body="לא מעלים. לא הופכים אותך ל-tier-2 בעוד שנה. לא גובים אחוז שונה לפי חודש. רק חצי אחוז להזמנה (זה עמלת סליקה רגילה) ומייל חינם. וזהו."
            decor="◕"
          />
        </div>

        <div className={styles.miniGrid}>
          <MiniCell tag="סניפים" title="מולטי-סניף" body="שעות, דמי משלוח ועמלת שירות נפרדים לכל סניף." />
          <MiniCell tag="שליחים" title="ניהול שליחים שלך" body="אזורי משלוח, ETA לכל אזור, הקצאה אוטומטית או ידנית." />
          <MiniCell tag="קמפיינים" title="פופאפים ובאנרים" body="מבצע בכניסה לחנות, באנר תמידי, או טריגר על שעות שיא." />
          <MiniCell tag="אנליטיקה" title="נתונים אמיתיים" body="שעות שיא, פריטים מובילים, AOV, אחוז חזרה של לקוחות." />
          <MiniCell tag="API" title="Webhooks + REST" body="חיבור ל-iCount, לקופה, ל-Wix Restaurants, או לפיתוח שלך." />
          <MiniCell tag="עברית" title="RTL בלידה" body="תוכנן לעברית מהיום הראשון. חודשים, סטטוסים, מספרים — הכל." />
        </div>
      </div>
    </section>
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
  decor,
}: {
  tone: WoltTone;
  layout?: WoltLayout;
  tag: string;
  heading: string;
  body: string;
  decor: string;
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
        {decor}
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

/* ─── PRICING ───────────────────────────────────────────── */
function Pricing() {
  const features = [
    "אפליקציית לקוח ממותגת על דומיין שלך",
    "דשבורד ניהול הזמנות, תפריט ושליחים",
    "תשלום inline — Bit, אשראי, Apple Pay, Google Pay",
    "מעקב הזמנה חי + סטטוס בלייב",
    "ביקורות אוטומטיות עם תזכורת",
    "וואטסאפ מהמספר שלך (דרך iBot Chat)",
    "מייל ללא הגבלה. חינם",
    "קמפיינים — פופאפים ובאנרים",
    "אזורי משלוח עם ETA לכל אזור",
    "אנליטיקה — שעות שיא, פריטים מובילים, חוזרים",
    "מולטי-סניף עם הגדרות נפרדות",
    "REST API + Webhooks לחיבור לקופה",
  ];
  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.pricingHead}>
          <div className={styles.sectionEyebrow}>כמה זה עולה</div>
          <h2 className={styles.sectionTitle}>
            תוכנית אחת. <em>נעולה לכל החיים.</em>
          </h2>
          <p className={styles.sectionLede}>
            בלי טיירים, בלי הפתעות בעוד שנה, בלי שדרוגי קומה כפויים. אותו מחיר היום, אותו מחיר בעוד עשר שנים.
          </p>
        </div>

        <div className={styles.priceSingleWrap}>
          <article className={styles.priceSingle}>
            <div className={styles.priceSingleHead}>
              <div className={styles.priceSingleTag}>תוכנית יחידה · נעולה</div>
              <div className={styles.priceSingleAmounts}>
                <div className={styles.priceSingleAmount}>
                  <span className={styles.priceSingleNum}>₪299</span>
                  <span className={styles.priceSingleUnit}>/ חודש</span>
                </div>
                <div className={styles.priceSingleSub}>+ מע״מ. נעול לכל החיים.</div>
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
                QuickFood, פתח לי חנות <IcoArrowLeft c="currentColor" s={14} />
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
                    קונים פעם אחת, נשלף אוטומטית לאישור הזמנה, יצא לדרך, ובקשות ביקורת. מייל כבר חינם בלי הגבלה.
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
              דברים שאתה <em>בטח תשאל.</em>
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
                בערך 11 דקות. נרשמים, בוחרים צבעים ולוגו, מקלידים תפריט בסיסי, מחברים את חשבון התשלום — ויש לך כתובת לשתף בוואטסאפ. ליווי אישי בהקמה — חינם, פשוט תפנה אלינו.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אז מה זה ה-0.5%?</summary>
              <p>
                זו עמלת הסליקה שאנחנו גובים על כל הזמנה — מה ששלמה לחברת האשראי שלך פלוס המעט שלנו על הפעולה. ביחס לשליש שגובים אצל הגדולים, זה בשורה התחתונה גרושים על כל הזמנה. הלקוח שלם 100 ש״ח? אצלנו חמישים אגורות יורדו לך.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>איזה אמצעי תשלום הלקוח רואה?</summary>
              <p>
                Bit, כרטיס אשראי, Apple Pay, Google Pay. כולם נפתחים בתוך המסך של החנות שלך — בלי דפים חיצוניים, בלי iframe-ים שמרגישים פושרים. אתה גם בוחר בדשבורד איזה אמצעי יהיה ברירת מחדל ראשונה.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>מה עם וואטסאפ וSMS?</summary>
              <p>
                מייל אנחנו שולחים בלי הגבלה, חינם. וואטסאפ ו-SMS — חבילות שמתחילות מ-₪39, ונשלפות אוטומטית לאישור הזמנה, יצאה לדרך, וביקורת. הוואטסאפ עובד מהמספר שלך (דרך iBot Chat), לא ממספר משותף.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אוספים ביקורות אוטומטית?</summary>
              <p>
                כן. שעה אחרי שהזמנה סומנה ׳נמסרה׳, הלקוח מקבל הודעה (וואטסאפ / SMS / מייל — אתה בוחר) עם לינק להשארת דירוג. הכוכבים מצטברים בדשבורד שלך, ואתה עונה על תגובות מאותו מסך.
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
                שתי אפשרויות. אחת — מנהלים שליחים שלך דרך המודול שלנו (כלול בתוכנית). שתיים — מתחברים לספק חיצוני. אזורי משלוח, ETA לאזור, דמי משלוח שונים — הכל בדשבורד.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>הלקוח רואה דף תודה גנרי או מסך מעקב?</summary>
              <p>
                לבחירתך. יש toggle בדשבורד — קבלה פשוטה כמו אתר אי-קומרס רגיל, או מסך מעקב חי עם ETA, סטטוס, ופרטי המסעדה. אם לא רוצה לחשוף זמני הכנה — מכבים.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>מה אם בעוד שנה תעלו לי את המחיר?</summary>
              <p>
                לא נעלה. המחיר נעול לכל החיים — ₪299 + מע״מ, וחצי אחוז על הזמנה. אם אנחנו נשנה את התמחור בעתיד, זה יחול רק על מי שייכנס אחרי השינוי. אתה תישאר במחיר ההצטרפות שלך.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אני יכול לקבל את הקוד או אפליקציה משלי באפסטור?</summary>
              <p>
                לארגונים גדולים יותר יש אפשרות הוצאת קוד וגם אפליקציה ייעודית באפסטור בשם שלך. תפנה אלינו, נדבר ישירות.
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
              11 דקות. <em>וזה הולך לעצמך.</em>
            </h2>
            <p>
              בלי כרטיס אשראי, בלי התחייבות, בלי שיחת מכירה. תיפתח חנות, תקבל הזמנה אחת, ותראה איך זה מרגיש כשאף אחד לא לוקח לך שליש באמצע.
            </p>
            <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnInk}`}>
              QuickFood, פתח לי חנות <IcoArrowLeft c="currentColor" s={14} />
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
              <small>BY QUICKSHOP — TEL AVIV / 2026</small>
            </div>
            <p className={styles.footTag}>
              חנות אונליין למסעדות שמכינות אוכל בעצמן ומוסרות אותו ללקוח. בלי לחלוק את הרווח עם החברות הגדולות.
            </p>
          </div>
          <div className={styles.footCol}>
            <h5>מוצר</h5>
            <a href="#product">דשבורד</a>
            <a href="#product">אפליקציה</a>
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
