import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { LeadForm } from "@/components/marketing/LeadForm";
import { IcoSparkle, IcoArrowLeft } from "@/components/shared/Icons";
import { QrCode, Users, MessageCircle, Sparkles, TrendingUp, Gift } from "lucide-react";

export const metadata: Metadata = {
  title: "QuickFood — הפוך לקוחות מזדמנים לנכס של העסק שלך",
  description:
    "אפליקציות המשלוחים מביאות לקוח חדש - וגובות ממך עליו שוב ושוב. QuickFood בונה למסעדה נכס דיגיטלי משלה: קהל לקוחות ששייך לעסק, עם QuickFood Boost שמחזיר אותם להזמין ישירות. יותר הזמנות ישירות, יותר רווח שנשאר אצלך.",
};

const YELLOW = "#F8CB1E";
const VIDEO = "https://videos.pexels.com/video-files/33880845/14378437_360_640_24fps.mp4";

function Dots() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.05]"
      style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      aria-hidden
    />
  );
}

// Browser-chrome frame around a real product screenshot - lends authority.
function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[0_6px_0_#000] bg-white">
      <div className="h-7 bg-black flex items-center gap-1.5 px-3">
        <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
      </div>
      <Image src={src} alt={alt} width={1600} height={1000} className="w-full h-auto" />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b-2 border-black">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <div className="font-black text-xl">QuickFood</div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/login" className="text-sm font-bold hover:underline">
            התחברות
          </Link>
          <Link
            href="/signup"
            className="bg-black text-white font-bold rounded-xl px-4 py-2 text-sm hover:bg-black/80 transition"
          >
            התחילו עכשיו
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: YELLOW }}>
      <Dots />
      <div className="relative max-w-6xl mx-auto px-5 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
        <div className="text-center lg:text-right">
          <div className="inline-block bg-black text-[#F8CB1E] text-xs font-black tracking-widest rounded-md px-3 py-1 mb-6">
            QUICKFOOD
          </div>
          <h1 className="text-black font-black text-4xl lg:text-5xl leading-[1.08]">
            אפליקציות המשלוחים מצוינות בלהביא לקוח חדש.
            <br />
            <span className="bg-black text-[#F8CB1E] px-3 rounded-lg inline-block mt-3">
              הבעיה מתחילה כשהוא חוזר.
            </span>
          </h1>
          <p className="mt-6 text-black/80 text-lg max-w-xl lg:mx-0 mx-auto leading-relaxed">
            כל הזמנה חוזרת דרך האפליקציה עולה לך שוב ~30% עמלה. QuickFood בונה לך דרך להחזיר את הלקוח
            להזמין ישירות — ולשמור את הרווח אצלך.
          </p>
          <div className="mt-8 flex flex-wrap items-center lg:justify-start justify-center gap-3">
            <Link
              href="/signup"
              className="bg-black text-white font-bold rounded-2xl px-7 h-14 inline-flex items-center text-base shadow-[0_4px_0_rgba(0,0,0,0.3)] hover:translate-y-0.5 transition"
            >
              התחילו 7 ימי ניסיון
            </Link>
            <a
              href="#how"
              className="bg-white text-black font-bold rounded-2xl px-7 h-14 inline-flex items-center text-base border-2 border-black"
            >
              איך זה עובד
            </a>
          </div>
          <div className="mt-4 text-sm text-black/60">בלי כרטיס אשראי · ₪299 לחודש מחיר קבוע</div>
        </div>

        {/* Phone-framed food video for life + authority */}
        <div className="flex justify-center lg:justify-start">
          <div className="relative w-[240px] sm:w-[270px] aspect-[9/16] rounded-[2.2rem] border-[7px] border-black bg-black overflow-hidden shadow-2xl">
            <video src={VIDEO} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const logos = ["visa", "mastercard", "amex", "apple-pay", "google-pay", "bit", "paybox"];
  return (
    <section className="border-b-2 border-black bg-white">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col lg:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-5 text-sm font-bold text-qf-ink">
          <span>7 ימי ניסיון</span>
          <span className="text-qf-line">·</span>
          <span>בלי כרטיס אשראי</span>
          <span className="text-qf-line">·</span>
          <span>ביטול בכל עת</span>
        </div>
        <div className="flex items-center gap-4 opacity-80 flex-wrap justify-center">
          {logos.map((l) => (
            <Image
              key={l}
              src={`/payments/${l}.webp`}
              alt={l}
              width={120}
              height={80}
              className="h-7 w-auto object-contain"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-20">
      <h2 className="font-black text-3xl lg:text-4xl text-center leading-tight">מי באמת מרוויח מהלקוח הקבוע שלך?</h2>
      <p className="mt-3 text-center text-qf-ink2 max-w-2xl mx-auto">
        לקוח שמזמין ממך 20 פעם בשנה דרך אפליקציה — אתה משלם עמלה על כל פעם מחדש. הוא הלקוח שלך, אבל הוא רשום אצלם.
      </p>
      <div className="mt-10 grid md:grid-cols-2 gap-5">
        <div className="rounded-3xl border-2 border-black p-7 shadow-[0_3px_0_#000]">
          <div className="text-xs font-black tracking-widest text-qf-tomato mb-2">דרך האפליקציה</div>
          <div className="text-2xl font-black">הלקוח חוזר — ואתה משלם שוב</div>
          <ul className="mt-4 space-y-2.5 text-qf-ink2 text-sm">
            <li>· ~30% עמלה על כל הזמנה חוזרת</li>
            <li>· אין לך את פרטי הלקוח</li>
            <li>· אתה מתחרה על אותו לקוח מול מסעדות אחרות</li>
            <li>· הקשר הוא שלהם, לא שלך</li>
          </ul>
        </div>
        <div className="rounded-3xl border-2 border-black p-7 shadow-[0_3px_0_#000]" style={{ backgroundColor: YELLOW }}>
          <div className="text-xs font-black tracking-widest mb-2">ישירות מ-QuickFood</div>
          <div className="text-2xl font-black">הלקוח חוזר — והרווח נשאר אצלך</div>
          <ul className="mt-4 space-y-2.5 text-black/80 text-sm font-medium">
            <li>· אפס עמלת פלטפורמה על הזמנה חוזרת</li>
            <li>· פרטי הלקוח שלך — טלפון, היסטוריה, העדפות</li>
            <li>· אתה פונה אליו ישירות, מתי שתרצה</li>
            <li>· הקשר שייך לעסק שלך</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Asset() {
  return (
    <section className="bg-black text-white">
      <div className="max-w-4xl mx-auto px-5 py-24 text-center">
        <h2 className="font-black text-3xl lg:text-5xl leading-tight">
          אתה לא צריך עוד אתר.
          <br />
          <span style={{ color: YELLOW }}>אתה צריך נכס.</span>
        </h2>
        <p className="mt-6 text-white/70 text-lg leading-relaxed max-w-2xl mx-auto">
          אתר, מערכת, אפליקציה — כולם בסוף משכירים לך לקוחות. QuickFood בונה לך משהו אחר:
          <br />
          <span className="text-white font-bold">
            קהל לקוחות שמחובר ישירות לעסק שלך, עם הדאטה, המותג והקשר — בבעלותך המלאה.
          </span>
        </p>
        <p className="mt-6 text-white/60">כל לקוח שעובר להזמין ישירות הופך לחלק מהנכס הדיגיטלי של המסעדה שלך.</p>
      </div>
    </section>
  );
}

function BoostReveal() {
  const caps = [
    { Icon: QrCode, t: "קמפייני QR", d: "על שקיות, קבלות וסטיקרים — עם מדידה" },
    { Icon: TrendingUp, t: "מקורות לקוחות", d: "מאיפה כל לקוח הגיע, באמת" },
    { Icon: Gift, t: "מועדון לקוחות", d: "נקודות, דרגות והטבות שמחזירות" },
    { Icon: MessageCircle, t: "קמפיינים", d: "וואטסאפ, SMS ומייל לפי סגמנט" },
    { Icon: Sparkles, t: "תובנות AI", d: "מה לעשות היום כדי להגדיל הזמנות" },
    { Icon: Users, t: "לקוחות חוזרים", d: "מי בסיכון לנטוש ומי ה-VIP שלך" },
  ];
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: YELLOW }}>
      <Dots />
      <div className="relative max-w-6xl mx-auto px-5 py-24">
        <div className="text-center">
          <div className="inline-block bg-black text-[#F8CB1E] text-xs font-black tracking-widest rounded-md px-3 py-1 mb-5">
            הכירו
          </div>
          <h2 className="font-black text-4xl lg:text-6xl text-black">QuickFood Boost</h2>
          <p className="mt-5 text-black/80 text-lg max-w-2xl mx-auto leading-relaxed">
            המנוע שהופך לקוחות מזדמנים — מ-Wolt, מגוגל, מהרחוב — ללקוחות ישירים שחוזרים אליך, ובונה לך
            את הנכס הדיגיטלי שלך, צעד אחר צעד.
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-8 items-center">
          <Shot src="/showcase/dashboard.png" alt="מסך QuickFood Boost" />
          <div className="grid sm:grid-cols-2 gap-3">
            {caps.map((c) => (
              <div key={c.t} className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
                <c.Icon size={22} strokeWidth={2.2} className="text-black" aria-hidden />
                <div className="font-black mt-2">{c.t}</div>
                <div className="text-xs text-qf-ink2 mt-0.5 leading-snug">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { t: "לקוח", d: "מגיע מאפליקציה, גוגל או מהרחוב" },
    { t: "QR", d: "סורק קוד על השקית או בחנות" },
    { t: "מועדון", d: "מצטרף ומשאיר פרטים" },
    { t: "קמפיין", d: "מקבל הטבה לחזור" },
    { t: "הזמנה ישירה", d: "חוזר להזמין מהאתר שלך" },
    { t: "VIP", d: "הופך ללקוח קבוע ונאמן" },
  ];
  return (
    <section id="how" className="max-w-6xl mx-auto px-5 py-20">
      <h2 className="font-black text-3xl lg:text-4xl text-center">איך Boost עובד</h2>
      <p className="mt-3 text-center text-qf-ink2">פשוט. כל שלב מקרב את הלקוח לבעלות שלך.</p>
      <div className="mt-10 flex flex-col md:flex-row items-stretch gap-3">
        {steps.map((s, i) => (
          <div key={s.t} className="flex items-stretch gap-3 flex-1 min-w-0">
            <div className="flex-1 rounded-2xl border-2 border-black p-4 text-center shadow-[0_3px_0_#000] flex flex-col justify-center">
              <div className="text-xs font-black tracking-widest text-qf-ink2">{String(i + 1).padStart(2, "0")}</div>
              <div className="font-black text-lg mt-1">{s.t}</div>
              <div className="text-[11px] text-qf-ink2 mt-1 leading-tight">{s.d}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="shrink-0 self-center rotate-90 md:rotate-0">
                <IcoArrowLeft s={18} c="#9ca3af" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EveryMorning() {
  const findings = [
    "14 לקוחות לא הזמינו כבר 30 יום — שלח קמפיין החזרה",
    "3 ימי הולדת היום — שלח קופון",
    "סריקות ה-QR מהשקיות ירדו השבוע — בקש מהצוות לצרף פלייר",
  ];
  return (
    <section className="bg-qf-bg">
      <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="font-black text-3xl lg:text-4xl leading-tight">
            כל בוקר, QuickFood אומר לך מה לעשות היום.
          </h2>
          <p className="mt-4 text-qf-ink2 text-lg leading-relaxed">
            לא דוחות ולא גרפים. סקירה אחת של 30 שניות עם ההזדמנויות של היום — ומה הצעד הבא שיחזיר לך
            לקוחות ויגדיל הזמנות ישירות.
          </p>
          <div className="mt-6 rounded-3xl border-2 border-black bg-white p-6 shadow-[0_3px_0_#000]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-black grid place-items-center">
                <IcoSparkle s={18} c={YELLOW} />
              </div>
              <div className="font-black text-lg">בוקר טוב. הנה מה שמצאתי היום:</div>
            </div>
            <ul className="space-y-3">
              {findings.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black/40 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 inline-flex items-center gap-2 bg-black/5 rounded-xl px-3 py-2 text-sm">
              <span className="text-qf-ink2">הזדמנות משוערת היום:</span>
              <span className="font-black">₪1,800</span>
            </div>
          </div>
        </div>
        <Shot src="/showcase/live-orders.png" alt="הזמנות חיות במערכת QuickFood" />
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-20">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Shot src="/showcase/dashboard.png" alt="דשבורד פיצה נינג׳ה" />
        <div>
          <div className="text-xs font-black tracking-widest text-qf-ink2 mb-3">סיפור הצלחה</div>
          <h2 className="font-black text-3xl lg:text-4xl">פיצה נינג׳ה</h2>
          <p className="mt-4 text-qf-ink2 text-lg leading-relaxed">
            התחילו עם רוב ההזמנות מאפליקציות. תוך כמה חודשים, עם QR על השקיות, מועדון לקוחות וקמפיינים
            — חלק הולך וגדל מהלקוחות חזר להזמין ישירות מהאתר שלהם. הרווח נשאר אצלם.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { n: "ישירות", l: "ערוץ ההזמנות שצומח" },
              { n: "0%", l: "עמלת פלטפורמה על חוזר" },
              { n: "הנכס", l: "קהל לקוחות בבעלותם" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border-2 border-black p-4 shadow-[0_3px_0_#000] text-center">
                <div className="font-black text-lg">{s.n}</div>
                <div className="text-[11px] text-qf-ink2 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Price() {
  return (
    <section className="bg-black text-white">
      <div className="max-w-3xl mx-auto px-5 py-20 text-center">
        <h2 className="font-black text-3xl lg:text-4xl">מחיר קבוע. בלי הפתעות.</h2>
        <p className="mt-4 text-white/70 text-lg">
          ₪299 לחודש + 0.5% להזמנה. הזמנה ישירה אחת בחודש שחוסכת לך עמלת פלטפורמה — כבר מכסה את העלות.
        </p>
        <div className="mt-8 inline-block rounded-3xl border-2 p-8" style={{ borderColor: YELLOW }}>
          <div className="text-5xl font-black" style={{ color: YELLOW }}>
            ₪299
          </div>
          <div className="text-white/60 mt-1">לחודש · מחיר קבוע</div>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center bg-white text-black font-bold rounded-2xl px-7 py-3.5"
          >
            התחילו 7 ימי ניסיון
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: YELLOW }}>
      <Dots />
      <div className="relative max-w-xl mx-auto px-5 py-20">
        <h2 className="font-black text-3xl lg:text-4xl text-black text-center leading-tight">
          5 דקות. ומתחילים לבנות את הנכס שלך.
        </h2>
        <p className="mt-3 text-black/70 text-center">השאר פרטים ונחזור אליך — או התחל לבד עכשיו.</p>
        <div className="mt-8 rounded-3xl border-2 border-black bg-white p-6 shadow-[0_3px_0_#000]">
          <LeadForm source="home2" submitLabel="דברו איתי" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black text-white/60">
      <div className="max-w-6xl mx-auto px-5 py-10 text-center text-sm">
        <div className="font-black text-white text-lg">QuickFood</div>
        <div className="mt-2">הנכס הדיגיטלי של המסעדה שלך.</div>
      </div>
    </footer>
  );
}

export default function Home2() {
  return (
    <main className="bg-white text-qf-ink" dir="rtl">
      <Nav />
      <Hero />
      <TrustStrip />
      <Problem />
      <Asset />
      <BoostReveal />
      <HowItWorks />
      <EveryMorning />
      <Proof />
      <Price />
      <FinalCta />
      <Footer />
    </main>
  );
}
