import type { Metadata } from "next";
import { Rubik, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import LiveDashboard from "./_components/LiveDashboard";
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
          <div className={styles.brandMark}>Q</div>
          <div>
            QuickFood
            <div className={styles.brandSub}>BY QUICKSHOP</div>
          </div>
        </a>
        <div className={styles.navLinks}>
          <a href="#product">המוצר</a>
          <a href="#features">פיצ&apos;רים</a>
          <a href="#pricing">תמחור</a>
          <a href="#faq">שאלות נפוצות</a>
        </div>
        <div className={styles.navCta}>
          <Link href="/dashboard/login" className={`${styles.btn} ${styles.btnGhost}`}>התחברות</Link>
          <Link href="/signup" className={`${styles.btn} ${styles.btnInk}`}>התחל חינם</Link>
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
              צפה בדמו ←
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
    <section className={`${styles.section} ${styles.problem}`}>
      <div className={styles.container}>
        <div className={`${styles.sectionEyebrow} ${styles.sectionEyebrowCheese}`}>למה QuickFood</div>
        <h2 className={styles.sectionTitle}>
          תוויות משלוח, גוגל שיטס וקבלות.<br />הגיע הזמן <em>להפסיק.</em>
        </h2>

        <div className={styles.problemGrid}>
          <div className={styles.problemCard}>
            <div className={styles.problemNum}>01 ─ עמלות</div>
            <h3>30% מכל הזמנה הולך לאגרגטור.</h3>
            <p>וולט, Tenbis ו-Cibus גובים עמלות מטורפות. ב-QuickFood אתה מקבל הזמנות ישירות מהלקוחות שלך, בלי מתווך באמצע.</p>
          </div>
          <div className={styles.problemCard}>
            <div className={styles.problemNum}>02 ─ זהות</div>
            <h3>באגרגטור אתה שורה ברשימה.</h3>
            <p>עם QuickFood אתה לינק ישיר ללקוח — אפליקציה בצבעים שלך, בלוגו שלך, בשם שלך. לא עוד מסעדה בין מאה.</p>
          </div>
          <div className={styles.problemCard}>
            <div className={styles.problemNum}>03 ─ נתונים</div>
            <h3>אתה לא יודע מי מזמין ממך.</h3>
            <p>הפלטפורמות הגדולות שומרות לעצמן את הלקוחות. QuickFood נותן לך את הנתונים, ההיסטוריה ויכולת לבנות בסיס לקוחות נאמן.</p>
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
              <div className={styles.miniDashHint}>קליק לפתיחת הדמו ←</div>
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

/* ─── BENTO FEATURES ─────────────────────────────────────── */
function Bento() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionEyebrow}>פיצ&apos;רים</div>
        <h2 className={styles.sectionTitle}>
          כל מה שהיית רוצה. <em>גם דברים שלא חשבת.</em>
        </h2>

        <div className={styles.bento}>
          <div className={`${styles.bentoCell} ${styles.bentoTomato} ${styles.bWide}`}>
            <span className={styles.bentoTag}>תשלום</span>
            <h4>תשלום ב-bit, אשראי, Apple Pay</h4>
            <p>אינטגרציה מובנית עם Grow Payments. הלקוח משלם בקליק, הכסף בחשבון העסק תוך 24 שעות.</p>
          </div>
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>מעקב</span>
            <h4>סטטוס חי</h4>
            <p>הלקוח רואה מתי הפיצה בתנור.</p>
          </div>
          <div className={`${styles.bentoCell} ${styles.bentoCheese}`}>
            <span className={styles.bentoTag}>SMS</span>
            <h4>הודעות מובנות</h4>
            <p>אישור, יצא לדרך, הגיע. ללא תשלום נוסף.</p>
          </div>
          <div className={`${styles.bentoCell} ${styles.bentoInk} ${styles.bTall}`}>
            <span className={styles.bentoTag}>מיתוג</span>
            <h4>ה-DNA שלך, לא שלנו.</h4>
            <p>בחר ערכת צבע, העלה לוגו, החלף שם. האפליקציה מרגישה כמו פיתוח מותאם, גם אם זה תוך 11 דקות.</p>
            <div className={styles.swatchRow}>
              <span className={styles.swatch} style={{ background: "#1f6b3c" }} />
              <span className={styles.swatch} style={{ background: "#d63f1a" }} />
              <span className={styles.swatch} style={{ background: "#f5b942" }} />
              <span className={styles.swatch} style={{ background: "#1a4dad" }} />
              <span className={styles.swatch} style={{ background: "#6b7a36" }} />
              <span className={styles.swatch} style={{ background: "#2a2926" }} />
              <span className={styles.swatch} style={{ background: "#15543a" }} />
            </div>
          </div>
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>אנליטיקה</span>
            <h4>נתונים אמיתיים</h4>
            <p>שעות שיא, פריטים מובילים, לקוחות חוזרים.</p>
          </div>
          <div className={`${styles.bentoCell} ${styles.bentoBasil}`}>
            <span className={styles.bentoTag}>משלוחים</span>
            <h4>ניהול שליחים</h4>
            <p>הקצאה אוטומטית או ידנית, מעקב, דירוגים.</p>
          </div>
          <div className={`${styles.bentoCell} ${styles.bWide}`}>
            <div className={styles.bentoMenuLayout}>
              <div>
                <span className={styles.bentoTag}>תפריט</span>
                <h4>עורך תפריט גמיש לחלוטין</h4>
                <p>גדלים, תוספות, הערות, מבצעים. הוסף פריט עם תמונה ב-30 שניות.</p>
              </div>
              <div className={styles.bentoMenuImg}>
                <Image
                  src="/img/landing/pizza-overhead.jpg"
                  alt="פיצה מעל"
                  fill
                  sizes="(max-width: 900px) 100vw, 140px"
                />
              </div>
            </div>
          </div>
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>RTL</span>
            <h4>עברית מנצחת</h4>
            <p>תוכנן לעברית מהשנייה הראשונה.</p>
          </div>
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>דומיין</span>
            <h4>הכתובת שלך</h4>
            <p>order.your-name.co.il. גם זה כלול.</p>
          </div>
        </div>
      </div>
    </section>
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
  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.pricingHead}>
          <div className={styles.sectionEyebrow}>תמחור</div>
          <h2 className={styles.sectionTitle}>פשוט. שקוף. <em>בלי הפתעות.</em></h2>
          <p className={styles.sectionLede}>
            בלי אחוזים מההזמנות. בלי תוספות. רק תוכנית חודשית קבועה ומה שאתה מרוויח — שלך.
          </p>
        </div>

        <div className={styles.priceGrid}>
          <PriceCard
            name="Starter"
            sub="לעסקים קטנים שמתחילים"
            amount="₪199"
            features={[
              "אפליקציית לקוח עם המיתוג שלך",
              "דשבורד ניהול הזמנות",
              "עד 50 הזמנות בחודש",
              "תשלום באשראי וב-bit",
              "תמיכה במייל ובוואטסאפ",
            ]}
            cta="התחל חינם 14 יום"
          />
          <PriceCard
            featured
            name="Growth"
            sub="הכי פופולרי בקרב מסעדות שכונתיות"
            amount="₪499"
            features={[
              "הכל מ-Starter",
              "הזמנות ללא הגבלה",
              "אנליטיקה מתקדמת",
              "ניהול ביקורות + תגובות",
              "קופונים ומבצעים",
              "תמיכת וואטסאפ בעדיפות",
            ]}
            cta="התחל חינם 14 יום"
          />
          <PriceCard
            name="Pro"
            sub="לרשתות וסניפים מרובים"
            amount="₪999"
            features={[
              "הכל מ-Growth",
              "ניהול שליחים מובנה",
              "סניפים מרובים",
              "גישת API מלאה",
              "דומיין מותאם",
              "Account Manager אישי",
            ]}
            cta="דבר איתנו"
          />
        </div>
      </div>
    </section>
  );
}

function PriceCard({
  name,
  sub,
  amount,
  features,
  cta,
  featured,
}: {
  name: string;
  sub: string;
  amount: string;
  features: string[];
  cta: string;
  featured?: boolean;
}) {
  return (
    <div className={`${styles.priceCard} ${featured ? styles.priceCardFeatured : ""}`}>
      <div className={styles.priceName}>{name}</div>
      <div className={styles.priceSub}>{sub}</div>
      <div className={styles.priceAmount}>
        {amount}
        <small> / חודש</small>
      </div>
      <ul className={styles.priceFeatures}>
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className={styles.priceCta}>
        <a href="#" className={`${styles.btn} ${styles.btnInk} ${styles.btnFull}`}>{cta}</a>
      </div>
    </div>
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
              <p>בממוצע 11 דקות מהרגע שאתה נרשם ועד שיש לך אפליקציה ודשבורד עובדים, עם תפריט בסיסי וכתובת לשתף. אם אתה רוצה ליווי אישי בהקמה — זה בחינם בכל התוכניות.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>איך זה שאין עמלה פר הזמנה?</summary>
              <p>אנחנו לא אגרגטור. אתה משלם תוכנית חודשית קבועה, ובמקום זה אתה שומר 100% מהמכירות. כן יש עמלת סליקה רגילה של חברת האשראי (כ-1.5%-2%) שזה תקני בכל המערכות.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>אני יכול לחבר את זה לקופה הקיימת שלי?</summary>
              <p>בתוכנית Pro יש REST API מלא + webhooks יוצאים, אז אתה יכול לחבר את QuickFood ל-iCount, Wix Restaurants או לכל קופה אחרת. אינטגרציות מוכנות-מראש ל-iCount ו-idani בתכנון לרבעון הקרוב.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>מה עם משלוחים?</summary>
              <p>יש לך שתי אפשרויות: לנהל שליחים שלך דרך מודול השליחים שלנו (כלול ב-Pro), או להתחבר לשירותי משלוחים חיצוניים כמו Wolt Drive או דליבר.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>אני יכול לקבל את הקוד?</summary>
              <p>בתוכנית Enterprise אנחנו מציעים אפשרות הוצאה מלאה של הקוד והנתונים, וגם אפשרות לאפליקציה מותאמת ב-App Store בשם שלך.</p>
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
        <h2>
          11 דקות.<br />
          <em>זה כל מה שצריך.</em>
        </h2>
        <p>14 יום חינם. בלי כרטיס אשראי. בלי התחייבות. רק האפשרות לראות איך נראות הזמנות שמגיעות ישר אליך.</p>
        <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnWhite}`}>
          פתח חנות עכשיו ←
        </Link>
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
