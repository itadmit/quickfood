import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { ProposalSign } from "./ProposalSign";
import { PROPOSAL_CSS } from "./styles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QuickFood · הצעת מחיר",
  robots: { index: false, follow: false },
};

function Ico({ d }: { d: React.ReactNode }) {
  return <svg viewBox="0 0 24 24">{d}</svg>;
}

export default async function QutePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await prisma.proposal.findUnique({ where: { token } });
  if (!p) notFound();

  const showCommission = Boolean(p.commissionStruck || p.commissionActual);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PROPOSAL_CSS }} />
      <div className="qute" dir="rtl">
        <div className="wrap">
          <div className="topbar">
            <div className="brand">
              <span className="mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="logo" src="/qute/logo.png" alt="QuickFood" />
              </span>
            </div>
            <span className="tag">הצעה - מה המערכת נותנת לך</span>
          </div>

          <div className="hero">
            <div className="hero-text">
              <h1>כל המסעדה שלך<br /><span className="hl">במערכת אחת</span></h1>
              <p>
                הכירו את <b>קוויק פוד</b>: הזמנות, מטבח, משלוחים, שיווק ולקוחות חוזרים - הכל מחובר,
                בלי עמלות גבוהות ובלי לקפוץ בין עשר מערכות. הנה כל מה שאתה מקבל ביום שמתחילים.
              </p>
              <div className="quote">
                <div className="quote-row">
                  <span className="quote-k">הצעה עבור</span>
                  <b className="quote-client">{p.clientName}</b>
                </div>
                <div className="quote-row">
                  <span className="quote-k">מחיר</span>
                  <span className="quote-price">{p.monthlyPrice.toLocaleString("he-IL")} ₪ <small>לחודש</small></span>
                </div>
                {showCommission && (
                  <div className="quote-row">
                    <span className="quote-k">עמלת מערכת</span>
                    <span className="quote-price">
                      {p.commissionStruck && <s>{p.commissionStruck}</s>}{" "}
                      {p.commissionActual && <span className="zero">{p.commissionActual}</span>}
                    </span>
                  </div>
                )}
                {p.notes && (
                  <div className="quote-note"><b>הערות:</b> {p.notes}</div>
                )}
              </div>
            </div>
            <div className="hero-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/qute/app-mockup.png" alt="אפליקציית QuickFood" />
            </div>
          </div>

          <section>
            <div className="sec-head"><div><div className="kicker">המערכת</div><h2>תפעול</h2></div><div className="rule" /></div>
            <div className="grid">
              <Card icon={<Ico d={<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z" fill="none" stroke="#000" strokeWidth="1.7" strokeLinejoin="round" />} />}
                title="דשבורד" body="תמונת מצב חיה של העסק - מכירות, הזמנות פתוחות ומגמות, במבט אחד כשנכנסים בבוקר." />
              <Card icon={<Ico d={<><path d="M5 4h14l-1 16H6L5 4z" fill="none" stroke="#000" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 4V3a3 3 0 016 0v1M9 10h6M9 14h4" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" /></>} />}
                title="הזמנות" body="כל הזמנה שנכנסת - במסך אחד, עם סטטוס בזמן אמת מהקבלה ועד המסירה." />
              <Card icon={<Ico d={<><circle cx="12" cy="12" r="8.5" fill="none" stroke="#000" strokeWidth="1.5" /><path d="M12 7.5V12l3 2" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></>} />}
                title="היסטוריית הזמנות" body="כל הזמנה נשמרת ונגישה - לחיפוש, החזרים, בירור מול לקוח וניתוח מה נמכר ומתי." />
              <Card icon={<Ico d={<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" fill="none" stroke="#000" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></>} />}
                title="מסך מטבח (K.D.S)" body="ההזמנות זורמות ישר למסך במטבח - הצוות רואה מה להכין, בלי פתקים ובלי בלגן בשעות העומס." />
              <Card neu icon={<Ico d={<path d="M5 7h14l-1 13H6L5 7zM9 7V5a3 3 0 016 0v2" fill="none" stroke="#000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />} />}
                title="מסך קופה (POS)" body="קופה מלאה לדלפק - סוגרים הזמנות במקום, מצרפים לאותה מערכת, בלי מכשיר נפרד וללא עמלות." />
              <Card icon={<Ico d={<><path d="M6 3h9.5L19 6.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="none" stroke="#000" strokeWidth="1.7" strokeLinejoin="round" /><path d="M15 3v3.5h4" fill="none" stroke="#000" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 11h7M8 14h7M8 17h4.5" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></>} />}
                title="תפריט" body="עריכת תפריט מלאה - קטגוריות, תוספות, מחירים ותמונות. שינוי אחד מתעדכן בכל הערוצים מיד." />
              <Card icon={<Ico d={<path d="M4 20V6M10 20v-8M16 20v-5M22 20H2" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" />} />}
                title="אנליטיקס" body="מספרים שמדברים - מנות מובילות, שעות שיא, לקוחות חוזרים והכנסה לפי ערוץ, בשפה ברורה." />
              <Card icon={<Ico d={<><circle cx="5.5" cy="17.5" r="3.5" fill="none" stroke="#000" strokeWidth="1.5" /><circle cx="18.5" cy="17.5" r="3.5" fill="none" stroke="#000" strokeWidth="1.5" /><circle cx="15" cy="5" r="1" fill="none" stroke="#000" strokeWidth="1.5" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>} />}
                title="שליחים" body="ניהול משלוחים מקצה לקצה - אפליקציית שליח, הקצאת שליח, מעקב סטטוס ומסירה, והלקוח מעודכן בכל שלב." />
              <Card icon={<Ico d={<><circle cx="12" cy="12" r="3" fill="none" stroke="#000" strokeWidth="1.6" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" fill="none" stroke="#000" strokeWidth="1.5" /></>} />}
                title="התאמה אישית ומיתוג" body="החנות נראית שלך, לא גנרית - צבעי המותג, לוגו, פונטים ודומיין משלך (למשל yourname.co.il). הלקוח מרגיש שהוא אצלך." />
              <Card addon="לא כולל ציוד חומרה"
                icon={<Ico d={<><rect x="5" y="3" width="14" height="14" rx="2" fill="none" stroke="#000" strokeWidth="1.7" /><path d="M9 21h6M12 17v4" fill="none" stroke="#000" strokeWidth="1.7" strokeLinecap="round" /><path d="M9 7h6M9 10h4" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></>} />}
                title="ממשק קיוסק" body="עמדת הזמנה עצמית לעסק - הלקוח מזמין לבד מהמסך, ההזמנה נכנסת ישר למערכת." />
            </div>
          </section>

          <div className="showcase">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/showcase/dashboard.png" alt="לוח הבקרה של QuickFood" />
          </div>

          <section>
            <div className="sec-head"><div><div className="kicker">המערכת</div><h2>שיווק וצמיחה</h2></div><div className="rule" /></div>
            <div className="grid">
              <Card neu icon={<Ico d={<path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />} />}
                title="QuickFood Boost" body="מנוע הצמיחה שלך - משימות יומיות ממוקדות שמביאות עוד לקוחות והזמנות חוזרות, בלי לנחש." />
              <Card icon={<Ico d={<path d="M3 10v4a1 1 0 001 1h2l8 4V5L6 9H4a1 1 0 00-1 1zm14-3v10c2-1 3-3 3-5s-1-4-3-5zM8 15v3a2 2 0 004 0" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />} />}
                title="קמפיינים" body="קמפיינים ממוקדים ללקוחות שלך - לבד או בלחיצה, עם מעקב על מי פתח, הזמין וחזר." />
              <Card neu icon={<Ico d={<><path d="M4 8l3.6 3.2L12 5l4.4 6.2L20 8l-1.5 9.5h-13L4 8z" fill="none" stroke="#000" strokeWidth="1.6" strokeLinejoin="round" /><path d="M5.5 20.5h13" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" /></>} />}
                title="מועדון לקוחות" body="מועדון נקודות ודרגות שמחזיר לקוחות שוב ושוב - הצטרפות בקופה ובצ'קאאוט, בלי כרטיסיות." />
              <Card icon={<Ico d={<><rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="#000" strokeWidth="1.6" /><path d="M3 10h18" fill="none" stroke="#000" strokeWidth="1.6" /><path d="M7 15h4" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" /></>} />}
                title="מבצעי חבילות" body="בונים חבילות ודילים שמעלים את שווי ההזמנה הממוצע - והם קופצים ללקוח ישר בעגלה." />
              <Card icon={<Ico d={<><rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="#000" strokeWidth="1.6" /><path d="M3 10h18" fill="none" stroke="#000" strokeWidth="1.6" /><path d="M7 15h4" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" /></>} />}
                title="קופונים" body="קודי הנחה לכל מטרה - לקוח חדש, חזרה לעגלה נטושה או מבצע יום - עם תקרה ותוקף שאתה קובע." />
              <Card icon={<Ico d={<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" fill="none" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />} />}
                title="ביקורות" body="אוספים חוות דעת מלקוחות אוטומטית אחרי הזמנה - ומפנים את המרוצים לדרג אתכם בגוגל." />
              <Card neu addon="מגוון חבילות דיוור החל מ-39 ₪"
                icon={<Ico d={<path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 004 0" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />} />}
                title="דיוור והתראות" body="הודעות ללקוח בערוץ הנכון - SMS, וואטסאפ או מייל - על סטטוס הזמנה, מבצעים ותזכורות חזרה." />
              <Card neu icon={<Ico d={<><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" fill="#000" /><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" fill="#000" /></>} />}
                title="יועץ AI" body="עוזר חכם שמלווה את הלקוח שלך לאורך ההזמנה - ממליץ על מנות, עונה על שאלות ומתאים את ההזמנה לטעם שלו, בדיוק כמו מלצר אישי." />
            </div>
          </section>

          <div className="cta">
            <h2>מערכת אחת. כל המסעדה. בלי עמלות גבוהות.</h2>
            <p>מחברים, מעלים תפריט - ומתחילים לעבוד. בואו נראה לך את זה חי.</p>
            <a className="btn" href="https://quickfood.co.il/" target="_blank" rel="noopener">למידע נוסף באתר</a>
          </div>

          <ProposalSign
            token={p.token}
            alreadySigned={p.status === "signed"}
            signerName={p.signerName}
          />

          <footer>
            QuickFood · הצעה זו משקפת את הפיצ'רים הקיימים במערכת ·{" "}
            <a href="https://quickfood.co.il/" target="_blank" rel="noopener">quickfood.co.il</a>
          </footer>
        </div>
      </div>
    </>
  );
}

function Card({ icon, title, body, neu, addon }: {
  icon: React.ReactNode; title: string; body: string; neu?: boolean; addon?: string;
}) {
  return (
    <div className="feat">
      {neu && <span className="new">חדש!</span>}
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {addon && <span className="addon">{addon}</span>}
    </div>
  );
}
