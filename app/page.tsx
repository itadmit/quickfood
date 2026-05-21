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
            <p>אגרגטורים גדולים גובים עמלות שיכולות לאכול שליש מהזמנה. ב-QuickFood אתה מקבל הזמנות ישירות מהלקוחות שלך, בלי מתווך באמצע.</p>
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
          <WoltCard
            tone="sky"
            tag="ההזמנות שלך"
            heading="ישירות מהלקוח אליך."
            body="בלי אגרגטור באמצע. הלקוח נוחת באפליקציה שלך עם הלוגו, השם והצבעים שלך, מזמין, ואתה רואה את ההזמנה בדשבורד תוך שניות. הקשר הוא בינך לבינו."
            decor="📦"
          />

          <WoltCard
            tone="cream"
            tag="תשלום מובנה"
            heading="Bit, אשראי, Apple Pay, Google Pay."
            body="ארנק התשלום של Grow רץ inline בתוך החנות שלך — אין הפניה לעמוד תשלום חיצוני, אין iframe מוזר. הלקוח רואה את הסל ואת כפתור התשלום באותו עמוד. הכסף בחשבון העסק תוך 24 שעות."
            decor="💳"
          />

          <WoltCard
            tone="blush"
            tag="ביקורות"
            heading="תזכורת אוטומטית בערוץ שלך."
            body="שעה אחרי שההזמנה מסומנת 'נמסרה' — תזכורת אוטומטית ב-SMS, WhatsApp או Email (לבחירתך) עם לינק לדירוג. הכוכבים מצטברים אצלך, אתה מגיב לתגובות מהדשבורד."
            decor="⭐"
          />

          <WoltCard
            tone="sky"
            tag="מעקב חי"
            heading="הלקוח רואה איפה ההזמנה."
            body="התקבלה ← בהכנה ← מוכנה ← בדרך. עדכון בלייב בלי refresh. בוחר אם להציג ETA או רק 'תודה' — toggle בדשבורד."
            decor="🚴"
          />

          <WoltCard
            tone="cream"
            tag="WhatsApp"
            heading="הודעות וואטסאפ מהמספר שלך."
            body="חיבור ל-iBot Chat — מספר משלך, לא משותף עם מסעדות אחרות. אישור הזמנה, יצא לדרך, ביקורת — הכל אוטומטי מאותה שיחה."
            decor="💬"
          />

          <WoltCard
            tone="indigo"
            tag="0 עמלה"
            heading="תשלום חודשי קבוע. בלי אחוזים מכל הזמנה."
            body="האגרגטורים גובים 25%–30% מכל הזמנה. ב-QuickFood אתה משלם תוכנית חודשית קבועה ושומר 100% מהמכירות. רק עמלת סליקת אשראי רגילה (~1.5%-2%) — תקני בכל המערכות."
            decor="💎"
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

        <div className={styles.bento} hidden>
          {/* 1. Inline checkout — hero feature */}
          <div className={`${styles.bentoCell} ${styles.bentoTomato} ${styles.bWide}`}>
            <span className={styles.bentoTag}>תשלום מובנה</span>
            <h4>Bit, אשראי, Apple Pay, Google Pay — הכל באותו מסך.</h4>
            <p>
              ארנק התשלום של Grow רץ inline בתוך החנות שלך — אין הפניה החוצה, אין עמוד תשלום נפרד.
              הלקוח רואה את הסל, את הכפתור, ומסיים תוך שניות. הכסף בחשבון העסק תוך 24 שעות.
            </p>
          </div>

          {/* 2. Live order tracking */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>מעקב חי</span>
            <h4>סטטוס בזמן אמת</h4>
            <p>SSE בלייב: התקבלה ← בהכנה ← מוכנה ← בדרך. בלי refresh.</p>
          </div>

          {/* 3. Reviews — phase 1 launched */}
          <div className={`${styles.bentoCell} ${styles.bentoCheese}`}>
            <span className={styles.bentoTag}>ביקורות</span>
            <h4>תזכורת אוטומטית לדירוג</h4>
            <p>שעה אחרי המסירה, תזכורת ב-SMS / WhatsApp / Email — לבחירתך. דירוגים פומביים בעמוד נפרד.</p>
          </div>

          {/* 4. WhatsApp — built-in via iBot */}
          <div className={`${styles.bentoCell} ${styles.bentoBasil}`}>
            <span className={styles.bentoTag}>WhatsApp</span>
            <h4>הודעות וואטסאפ מובנות</h4>
            <p>חיבור ל-iBot Chat. אישור הזמנה, יצא לדרך, ביקורת — בלי לעבור לטלפון פעמיים.</p>
          </div>

          {/* 5. Branding — tall column */}
          <div className={`${styles.bentoCell} ${styles.bentoInk} ${styles.bTall}`}>
            <span className={styles.bentoTag}>מיתוג</span>
            <h4>ה-DNA שלך, לא שלנו.</h4>
            <p>
              בחר ערכת צבע, העלה לוגו, הוסף תמונת כריכה, החלף את שם החנות והסלוגן. דומיין מותאם
              (order.your-name.co.il) כלול גם בתוכניות הבסיסיות.
            </p>
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

          {/* 6. Analytics */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>אנליטיקה</span>
            <h4>נתונים אמיתיים</h4>
            <p>שעות שיא, פריטים מובילים, ערך הזמנה ממוצע, אחוז לקוחות חוזרים.</p>
          </div>

          {/* 7. Couriers + delivery zones */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>שליחים</span>
            <h4>שליחים + אזורי משלוח</h4>
            <p>הגדר אזורים על מפה, ETA לכל אזור, הקצה שליחים אוטומטית או ידנית.</p>
          </div>

          {/* 8. Menu editor — wide with photo */}
          <div className={`${styles.bentoCell} ${styles.bWide}`}>
            <div className={styles.bentoMenuLayout}>
              <div>
                <span className={styles.bentoTag}>תפריט</span>
                <h4>עורך תפריט גמיש לחלוטין</h4>
                <p>
                  גדלים, תוספות (single/multi), הערות, מבצעים, סטוקים. גרור-זרוק לסידור. הוסף פריט עם תמונה ב-30 שניות.
                </p>
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

          {/* 9. Campaigns — popup + banner */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>קמפיינים</span>
            <h4>פופאפים ובאנרים</h4>
            <p>הצג קמפיין בכניסה לחנות או באנר תמידי. תזמן, נטרל, נסה גרסאות.</p>
          </div>

          {/* 10. SMS credits */}
          <div className={`${styles.bentoCell} ${styles.bentoCheese}`}>
            <span className={styles.bentoTag}>SMS</span>
            <h4>בלוקים גמישים</h4>
            <p>קנה בלוק קרדיטים פעם אחת, נשלף מאותו pool ל-SMS וגם ל-WhatsApp. בלי הפתעות.</p>
          </div>

          {/* 11. Multi-branch */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>סניפים</span>
            <h4>מולטי-סניף</h4>
            <p>סניפים מרובים עם שעות פעילות, דמי משלוח ושירות נפרדים לכל אחד.</p>
          </div>

          {/* 12. Smart checkout polish */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>חוויית רכישה</span>
            <h4>חוויית רכישה מודרנית</h4>
            <p>הזמן שוב בקליק, prefill לכתובת+תשלום, אזהרה כשהמחיר עלה, סקלטונים בכל מסך.</p>
          </div>

          {/* 13. Reviews-driven trust */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>RTL</span>
            <h4>עברית מנצחת</h4>
            <p>תוכנן לעברית מהשנייה הראשונה — RTL מלא, ניקוד, חודשים בעברית, מספרים tabular.</p>
          </div>

          {/* 14. Webhooks + API */}
          <div className={styles.bentoCell}>
            <span className={styles.bentoTag}>אינטגרציות</span>
            <h4>Webhooks + REST API</h4>
            <p>חבר את ההזמנות לקופה, iCount, מערכת CRM. אירועים יוצאים בכל סטטוס שמשתנה.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type WoltTone = "sky" | "cream" | "blush" | "indigo";

function WoltCard({
  tone,
  tag,
  heading,
  body,
  decor,
}: {
  tone: WoltTone;
  tag: string;
  heading: string;
  body: string;
  decor: string;
}) {
  const toneClass = {
    sky: styles.woltCardSky,
    cream: styles.woltCardCream,
    blush: styles.woltCardBlush,
    indigo: styles.woltCardIndigo,
  }[tone];
  return (
    <article className={`${styles.woltCard} ${toneClass}`}>
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
              "אפליקציית לקוח ממותגת",
              "דשבורד ניהול הזמנות",
              "תשלום inline: Bit / אשראי / Apple Pay / Google Pay",
              "מעקב הזמנה חי + סטטוס SSE",
              "תפריט עם תמונות, גדלים ותוספות",
              "תמיכה במייל",
            ]}
            cta="התחל ניסיון של 7 יום"
          />
          <PriceCard
            featured
            name="Growth"
            sub="הכי פופולרי בקרב מסעדות שכונתיות"
            amount="₪499"
            features={[
              "הכל מ-Starter",
              "הזמנות ללא הגבלה",
              "ביקורות + תזכורת אוטומטית (SMS/WhatsApp/Email)",
              "WhatsApp דרך iBot Chat",
              "קמפיינים: פופאפים ובאנרים",
              "ניהול שליחים + אזורי משלוח",
              "אנליטיקה מתקדמת",
              "תמיכת וואטסאפ בעדיפות",
            ]}
            cta="התחל ניסיון של 7 יום"
          />
          <PriceCard
            name="Pro"
            sub="לרשתות וסניפים מרובים"
            amount="₪999"
            features={[
              "הכל מ-Growth",
              "סניפים מרובים",
              "REST API מלא + Webhooks",
              "דומיין מותאם משלך",
              "אינטגרציות לקופה (iCount, idani — בקרוב)",
              "Account Manager אישי",
              "SLA 99.9% + עדיפות יציאה לאוויר",
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
        <h2>
          11 דקות.<br />
          <em>זה כל מה שצריך.</em>
        </h2>
        <p>14 יום חינם. בלי כרטיס אשראי. בלי התחייבות. רק האפשרות לראות איך נראות הזמנות שמגיעות ישר אליך.</p>
        <Link href="/signup" className={`${styles.btn} ${styles.btnLg} ${styles.btnWhite}`}>
          פתח חנות עכשיו <IcoArrowLeft c="currentColor" s={14} />
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
