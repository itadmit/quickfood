import type { Metadata } from "next";
import { Rubik, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import LiveDashboard from "./_components/LiveDashboard";
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
  title: "QuickFood — מסעדה אונליין בשתי לחיצות",
  description:
    "פלטפורמת SaaS שמרימה למסעדה אפליקציית הזמנות + דשבורד ניהול תוך פחות משעה. בלי עמלות פר הזמנה, בלי אגרגטור, רק הלקוחות שלך.",
};

export default function LandingPage() {
  return (
    <div className={`${styles.root} ${rubik.variable} ${mono.variable}`}>
      <Nav />
      <Hero />
      <Marquee />
      <Problem />
      <Showcase />
      <Bento />
      <FoodGallery />
      <Rotator />
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
      <div className={styles.heroDecoPhoto} aria-hidden="true">
        <div className={styles.heroDecoPhotoInner}>
          <Image
            src="/img/landing/pizza-margherita.jpg"
            alt=""
            fill
            sizes="(max-width: 1100px) 360px, 520px"
            priority
          />
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot}>חדש</span>
          פלטפורמה לעסקי אוכל ישראלים
        </div>

        <h1 className={styles.headline}>
          <span className={styles.stack}>המסעדה שלך</span>
          <span className={styles.stack}>אונליין</span>
          <span className={styles.stack}><em>תוך 11 דקות.</em></span>
          <span className={styles.headlineSmall}>
            אפליקציית הזמנות, דשבורד ניהול ותפריט עם תמונות — מוכנים לפני שהפיצה הראשונה יוצאת מהתנור. בלי אגרגטור, בלי עמלה פר הזמנה.
          </span>
        </h1>

        <div className={styles.heroMeta}>
          <div className={styles.heroCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnTomato} ${styles.btnLg}`}>
              התחל ניסיון של 14 יום
            </Link>
            <a
              href="#product"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostOutline} ${styles.btnLg}`}
            >
              צפה בדמו <IcoArrowLeft c="currentColor" s={14} />
            </a>
          </div>
          <div className={styles.heroStats}>
            <div>
              <div className={styles.heroStatN}>11 דק׳</div>
              <div className={styles.heroStatL}>מאפס לאוויר</div>
            </div>
            <div>
              <div className={styles.heroStatN}>0%</div>
              <div className={styles.heroStatL}>עמלת אגרגטור</div>
            </div>
            <div>
              <div className={styles.heroStatN}>24/7</div>
              <div className={styles.heroStatL}>תמיכה בעברית</div>
            </div>
          </div>
        </div>

        <LiveDashboard />
      </div>
    </header>
  );
}

/* ─── MARQUEE ────────────────────────────────────────────── */
function Marquee() {
  return (
    <div className={styles.marquee}>
      <div className={styles.marqueeTrack}>
        <span>
          <em>פיצריות.</em> <span className={styles.marqueeDot}>●</span> פלאפליות.{" "}
          <span className={styles.marqueeDot}>●</span> <em>המבורגריות.</em>{" "}
          <span className={styles.marqueeDot}>●</span> סושיה.{" "}
          <span className={styles.marqueeDot}>●</span> <em>גלידריות.</em>{" "}
          <span className={styles.marqueeDot}>●</span> בייקריס.{" "}
          <span className={styles.marqueeDot}>●</span> <em>פיצריות.</em>{" "}
          <span className={styles.marqueeDot}>●</span> פלאפליות.{" "}
          <span className={styles.marqueeDot}>●</span> <em>המבורגריות.</em>{" "}
          <span className={styles.marqueeDot}>●</span> סושיה.{" "}
          <span className={styles.marqueeDot}>●</span> <em>גלידריות.</em>{" "}
          <span className={styles.marqueeDot}>●</span> בייקריס.
        </span>
      </div>
    </div>
  );
}

/* ─── PROBLEM ────────────────────────────────────────────── */
function Problem() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>למה QuickFood</div>
        <h2 className={styles.sectionTitle}>
          תוויות משלוח, גוגל שיטס וקבלות. <em>הגיע הזמן להפסיק.</em>
        </h2>

        <div className={styles.problemGrid}>
          <div className={`${styles.problemCard} ${styles.problemCardPeach}`}>
            <div className={styles.problemNum}>01</div>
            <h3>עמלות שאוכלות שליש.</h3>
            <p>אגרגטורים גדולים גובים 25%–30% מכל הזמנה. ב-QuickFood אתה מקבל הזמנות ישירות מהלקוחות שלך, בלי מתווך — ומשלם תוכנית חודשית קבועה.</p>
          </div>
          <div className={`${styles.problemCard} ${styles.problemCardMist}`}>
            <div className={styles.problemNum}>02</div>
            <h3>שורה ברשימה — או חנות משלך.</h3>
            <p>באגרגטור אתה עוד אחד מ-מאה. עם QuickFood הלקוח נוחת באפליקציה עם הלוגו שלך, בצבעים שלך, בשם שלך. הקשר הוא בינך לבינו.</p>
          </div>
          <div className={`${styles.problemCard} ${styles.problemCardLilac}`}>
            <div className={styles.problemNum}>03</div>
            <h3>הנתונים אצלך, לא אצל מישהו אחר.</h3>
            <p>הפלטפורמות שומרות לעצמן את הלקוחות. אצלנו הנתונים שלך — ההיסטוריה, הטלפונים, ההעדפות — נשארים אצלך, ולך יש מה לעשות איתם.</p>
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
            <h2 className={styles.sectionTitle}>שני מוצרים. <em>סיפור אחד.</em></h2>
          </div>
          <p className={styles.sectionLede}>
            אפליקציית לקוח שמרגישה כמו של הגדולים, ודשבורד ניהול שכל אחד יכול לתפעל — מהמנהל ועד עובד המשמרת. הכל מובנה לרוץ מהיום הראשון.
          </p>
        </div>

        <div className={styles.showcaseGrid}>
          <div className={`${styles.showcaseCard} ${styles.showcaseCardDark}`}>
            <div className={styles.showcaseTag}>למסעדה</div>
            <h3>דשבורד שמרגיש כמו קוקפיט.</h3>
            <p>קבלת הזמנות בלחיצה, מעקב חי, ניהול תפריט, סטטיסטיקות אמת ושליחים. הכל ממקום אחד, מותאם לטאבלט שעומד ליד הקופה.</p>
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
            <div className={styles.showcaseTag}>ללקוח</div>
            <h3>חוויה בטעם של עוד.</h3>
            <p>אפליקציה מהירה, יפה, ושלך — לא עוד פיצרייה ברשימה של אגרגטור.</p>

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

/* ─── FEATURES — WOLT-STYLE STACKED CARDS ────────────────── */
function Bento() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>פיצ&apos;רים</div>
        <h2 className={styles.sectionTitle}>
          כל מה שצריך כדי לקבל הזמנות. <em>וכל מה שלא חשבת שצריך.</em>
        </h2>

        <div className={styles.woltStack}>
          {/* Card 1 — wide hero with the illustration peeking from the
              bottom-end. Sets the rhythm. */}
          <WoltCard
            tone="mist"
            layout="wide"
            tag="ההזמנות שלך"
            heading="ישירות מהלקוח אליך."
            body="בלי אגרגטור באמצע. הלקוח נוחת באפליקציה שלך עם הלוגו, השם והצבעים שלך, מזמין, ואתה רואה את ההזמנה בדשבורד תוך שניות. הקשר הוא בינך לבינו."
            decor="📦"
          />

          {/* Card 2 — decor on the START side, payment story */}
          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="תשלום מובנה"
            heading="Bit, אשראי, Apple Pay, Google Pay."
            body="ארנק התשלום של Grow רץ inline בתוך החנות שלך — אין הפניה לעמוד תשלום חיצוני, אין iframe מוזר. הלקוח רואה את הסל ואת כפתור התשלום באותו עמוד. הכסף בחשבון העסק תוך 24 שעות."
            decor="💳"
          />

          {/* Card 3 — decor on the END side, reviews */}
          <WoltCard
            tone="peach"
            layout="decor-end"
            tag="ביקורות"
            heading="תזכורת אוטומטית בערוץ שלך."
            body="שעה אחרי שההזמנה מסומנת ׳נמסרה׳ — תזכורת אוטומטית ב-SMS, WhatsApp או Email (לבחירתך) עם לינק לדירוג. הכוכבים מצטברים אצלך, אתה מגיב מהדשבורד."
            decor="⭐"
          />

          {/* Card 4 — wide hero again, live tracking */}
          <WoltCard
            tone="lilac"
            layout="wide"
            tag="מעקב חי"
            heading="הלקוח רואה איפה ההזמנה — בזמן אמת."
            body="התקבלה ← בהכנה ← מוכנה ← בדרך. עדכון בלייב בלי refresh. אפשר לבחור אם להציג ETA או רק ׳תודה רבה׳ — toggle בדשבורד."
            decor="🛵"
          />

          {/* Card 5 — decor on the START side, WhatsApp */}
          <WoltCard
            tone="sand"
            layout="decor-start"
            tag="WhatsApp"
            heading="הודעות וואטסאפ מהמספר שלך."
            body="חיבור ל-iBot Chat — מספר משלך, לא משותף עם מסעדות אחרות. אישור הזמנה, יצא לדרך, ביקורת — הכל אוטומטי מאותה שיחה."
            decor="💬"
          />

          {/* Card 6 — midnight anchor, decor wide */}
          <WoltCard
            tone="midnight"
            layout="wide"
            tag="0% עמלה פר הזמנה"
            heading="תוכנית חודשית קבועה. כל השאר — שלך."
            body="האגרגטורים גובים 25%–30% מכל הזמנה. ב-QuickFood משלמים תוכנית חודשית קבועה ושומרים 100% מהמכירות. רק עמלת סליקת אשראי רגילה (~1.5%-2%) — תקני בכל המערכות."
            decor="✦"
          />
        </div>

        {/* Secondary feature grid — quieter, for everything the stacked
            cards don't deserve full attention for. */}
        <div className={styles.miniGrid}>
          <MiniCell tag="מולטי-סניף" title="סניפים מרובים" body="שעות, דמי משלוח וטיפים נפרדים לכל סניף." />
          <MiniCell tag="שליחים" title="ניהול שליחים" body="אזורי משלוח על מפה, ETA לכל אזור, הקצאה אוטו׳." />
          <MiniCell tag="קמפיינים" title="פופאפים ובאנרים" body="הצג מבצע בכניסה לחנות, או באנר תמידי במסך הבית." />
          <MiniCell tag="אנליטיקה" title="נתונים אמיתיים" body="שעות שיא, פריטים מובילים, ערך הזמנה ממוצע." />
          <MiniCell tag="API" title="Webhooks + REST" body="חבר לקופה, ל-iCount או לכל מערכת חיצונית." />
          <MiniCell tag="RTL" title="עברית מנצחת" body="RTL מלא, ניקוד, חודשים בעברית, מספרים tabular." />
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

/* ─── FOOD GALLERY ───────────────────────────────────────── */
const GALLERY: { src: string; label: string; alt: string }[] = [
  { src: "/img/landing/pizza-margherita.jpg", label: "פיצה",   alt: "פיצה מרגריטה" },
  { src: "/img/landing/burger.jpg",           label: "בורגר",  alt: "המבורגר כפול" },
  { src: "/img/landing/pasta.jpg",            label: "פסטה",   alt: "פטוצ׳יני" },
  { src: "/img/landing/sushi.jpg",            label: "סושי",   alt: "סושי סלמון" },
  { src: "/img/landing/hummus.jpg",           label: "מזרחי",  alt: "מנה מזרחית" },
  { src: "/img/landing/pizza-cheese.jpg",     label: "מאפים", alt: "פיצה גבינות חמה" },
  { src: "/img/landing/icecream.jpg",         label: "קינוח",  alt: "קינוח קר" },
  { src: "/img/landing/kitchen.jpg",          label: "מטבח",   alt: "מטבח" },
];

function FoodGallery() {
  return (
    <section className={styles.foodGallery}>
      <div className={styles.container}>
        <div className={styles.foodGalleryHead}>
          <h3>
            ממרגריטה ועד שווארמה. <em>תפריט אחד.</em>
          </h3>
          <p>
            QuickFood לא יודע מה אתה מבשל — הוא יודע איך למכור את זה.
            הנה מי כבר משתמש (או בקרוב יהיה).
          </p>
        </div>

        <div className={styles.foodGalleryRow}>
          {GALLERY.map((g) => (
            <div key={g.src} className={styles.foodChip}>
              <Image src={g.src} alt={g.alt} fill sizes="(max-width: 900px) 25vw, 12vw" />
              <div className={styles.foodChipLabel}>{g.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── ROTATING WORDS ─────────────────────────────────────── */
function Rotator() {
  return (
    <section className={styles.rotatorSection}>
      <div className={styles.container}>
        <span className={styles.rotatorPre}>בנוי עבור </span>
        <div className={styles.rotatorStage}>
          <span>פיצריות.</span>
          <span>פלאפליות.</span>
          <span>סושיה.</span>
          <span>בייקריס.</span>
          <span>גלידריות.</span>
        </div>
        <div className={styles.rotatorPost}>
          בשורה התחתונה, אם אתה מכין אוכל ורוצה למכור אותו אונליין — QuickFood כנראה הכלי שלך.
        </div>
      </div>
    </section>
  );
}

/* ─── PRICING ───────────────────────────────────────────── */
function Pricing() {
  const features = [
    "אפליקציית לקוח ממותגת",
    "דשבורד ניהול הזמנות מלא",
    "תשלום inline: Bit / אשראי / Apple Pay / Google Pay",
    "מעקב הזמנה חי + סטטוס SSE",
    "ביקורות + תזכורת אוטומטית (SMS / WhatsApp / Email)",
    "WhatsApp דרך iBot Chat (מספר משלך)",
    "קמפיינים — פופאפים ובאנרים",
    "ניהול שליחים + אזורי משלוח",
    "אנליטיקה מתקדמת",
    "סניפים מרובים",
    "REST API + Webhooks",
    "תמיכה בוואטסאפ",
  ];
  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.pricingHead}>
          <div className={styles.sectionEyebrow}>תמחור</div>
          <h2 className={styles.sectionTitle}>פשוט. שקוף. <em>בלי הפתעות.</em></h2>
          <p className={styles.sectionLede}>
            תוכנית אחת לכולם, ועמלת סליקה נמוכה במקום אחוזים של אגרגטור. כל מה שיש לנו — כלול.
          </p>
        </div>

        <div className={styles.priceSingleWrap}>
          <article className={styles.priceSingle}>
            <div className={styles.priceSingleHead}>
              <div className={styles.priceSingleTag}>תוכנית יחידה</div>
              <div className={styles.priceSingleAmounts}>
                <div className={styles.priceSingleAmount}>
                  <span className={styles.priceSingleNum}>₪299</span>
                  <span className={styles.priceSingleUnit}>/ חודש</span>
                </div>
                <div className={styles.priceSingleSub}>+ מע״מ</div>
              </div>
              <div className={styles.priceSingleFee}>
                <span className={styles.priceSingleFeeNum}>0.5%</span>
                <span className={styles.priceSingleFeeLabel}>
                  עמלת סליקה לכל הזמנה
                  <small> + מע״מ</small>
                </span>
              </div>
              <Link
                href="/signup"
                className={`${styles.btn} ${styles.btnLg} ${styles.btnInk} ${styles.btnFull}`}
              >
                התחל ניסיון של 7 ימים <IcoArrowLeft c="currentColor" s={14} />
              </Link>
              <div className={styles.priceSingleNote}>
                7 ימים חינם · בלי כרטיס אשראי · בטל מתי שתרצה
              </div>
            </div>
            <div className={styles.priceSingleBody}>
              <div className={styles.priceSingleIncluded}>כלול בתוכנית:</div>
              <ul className={styles.priceFeatures}>
                {features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
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
                בממוצע 11 דקות מהרגע שאתה נרשם ועד שיש לך אפליקציה ודשבורד עובדים, עם תפריט בסיסי, חיבור Grow לתשלום וכתובת לשתף. ניסיון של 7 ימים בלי כרטיס אשראי. אם אתה רוצה ליווי אישי בהקמה — זה בחינם בכל התוכניות.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>איך זה שאין עמלה פר הזמנה?</summary>
              <p>
                אנחנו לא אגרגטור. אתה משלם תוכנית חודשית קבועה, ובמקום זה אתה שומר 100% מהמכירות. כן יש עמלת סליקה רגילה של חברת האשראי (כ-1.5%-2%) שזה תקני בכל המערכות, ויורדת ישירות ב-Grow.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>איזה אמצעי תשלום נתמכים בחנות?</summary>
              <p>
                Bit, כרטיס אשראי, Apple Pay, Google Pay — כולם רצים inline בתוך המסך של החנות שלך דרך ה-SDK של Grow. אין הפניה לעמוד תשלום חיצוני, אין שובר שמופיע ב-iframe. הלקוח רואה את הסל ואת כפתור התשלום באותו עמוד.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>איך אני שולח SMS / WhatsApp ללקוחות?</summary>
              <p>
                SMS מובנה — קונים בלוק קרדיטים, נשלף לאישור הזמנה, יצא לדרך, ובקשות ביקורת. WhatsApp דרך חיבור ל-iBot Chat (מספר שלך, לא משותף). שני הערוצים נשלפים מאותו pool של קרדיטים.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אספים ביקורות מהלקוחות?</summary>
              <p>
                כן. שעה אחרי שהזמנה מסומנת "נמסרה" אנחנו שולחים תזכורת אוטומטית בערוץ שתבחר (SMS / WhatsApp / Email) עם לינק להשארת דירוג. הביקורות נשארות אצלך — דירוג ממוצע, כוכבים, ותגובות שאתה כותב.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אני יכול לחבר את זה לקופה הקיימת שלי?</summary>
              <p>
                בכל התוכניות יש REST API מלא + webhooks יוצאים על כל אירוע (order.created, order.status_changed, וכו׳). אתה יכול לחבר את QuickFood ל-iCount, Wix Restaurants או לכל קופה אחרת. אינטגרציות מוכנות-מראש ל-iCount ול-idani בתכנון לרבעון הקרוב.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>מה עם משלוחים?</summary>
              <p>
                יש לך שתי אפשרויות: לנהל שליחים שלך דרך מודול השליחים שלנו (כלול ב-Growth + Pro), או להתחבר לספקי משלוחים חיצוניים. אזורי משלוח, ETA לכל אזור ודמי משלוח שונים — הכל מוגדר בדשבורד.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>הלקוח רואה דף תודה גנרי או מעקב מלא?</summary>
              <p>
                בחירה שלך. בדשבורד יש toggle בין &quot;קבלה פשוטה&quot; (כמו אי-קומרס רגיל) לבין &quot;מעקב חי&quot; (timeline בזמן אמת + ETA + פרטי המסעדה). אם לא תרצה לחשוף ETA — תכבה.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>אני יכול לקבל את הקוד?</summary>
              <p>
                בתוכנית Enterprise אנחנו מציעים אפשרות הוצאה מלאה של הקוד והנתונים, וגם אפשרות לאפליקציה מותאמת ב-App Store בשם שלך.
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
            <span className={styles.finalCtaTag}>7 ימים חינם</span>
            <h2>
              11 דקות. <em>זה כל מה שצריך.</em>
            </h2>
            <p>
              7 ימי ניסיון בלי כרטיס אשראי. בלי התחייבות. רק האפשרות לראות איך נראות הזמנות שמגיעות ישר אליך — ולהוציא אם זה לא מתאים.
            </p>
            <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnWhite}`}>
              פתח חנות עכשיו <IcoArrowLeft c="currentColor" s={14} />
            </Link>
          </div>
          <div className={styles.finalCtaArt} aria-hidden>🍕</div>
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
              פלטפורמת SaaS שעוזרת למסעדות וקטנים לקבל הזמנות ישירות, בלי מתווכים ובלי כאב ראש.
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
