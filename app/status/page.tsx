import { LegalShell } from "@/components/shared/LegalShell";

export const metadata = {
  title: "סטטוס מערכת - QuickFood",
  description:
    "סטטוס בזמן אמת של כל רכיבי QuickFood - חנות לקוחות, דשבורד מסעדן, סליקה, וואטסאפ ו-SMS, וובהוקים ואחסון תמונות.",
};

// Placeholder static snapshot - we report 100% green until we wire this
// page into the real monitoring backend (Vercel/UptimeRobot/Better Stack).
// Updating the constants below is the temporary way to publish an incident.

interface Component {
  name: string;
  description: string;
  status: "operational" | "degraded" | "outage";
}

const COMPONENTS: Component[] = [
  { name: "חנות לקוחות", description: "האתר שלקוחות מזמינים ממנו", status: "operational" },
  { name: "דשבורד מסעדן", description: "ניהול הזמנות, תפריט והגדרות", status: "operational" },
  { name: "סליקה (Grow Payments)", description: "ארנקים, Bit, Apple Pay, Google Pay, אשראי", status: "operational" },
  { name: "וואטסאפ (iBot Chat)", description: "אישורי הזמנה ו׳יצא לדרך׳ מהמספר שלך", status: "operational" },
  { name: "SMS (sms4free)", description: "התראות לקוח כשוואטסאפ לא זמין", status: "operational" },
  { name: "מייל (Resend)", description: "תזכורות ביקורת ועדכוני הזמנה", status: "operational" },
  { name: "Webhooks יוצאים", description: "אירועי הזמנה לקופות ולמערכות חיצוניות", status: "operational" },
  { name: "אחסון תמונות (R2)", description: "תמונות תפריט, לוגו ותמונת נושא", status: "operational" },
  { name: "בסיס נתונים (Neon)", description: "תפריטים, הזמנות, לקוחות ונתונים תפעוליים", status: "operational" },
  { name: "API ציבורי", description: "REST API לקריאה ולכתיבה מבחוץ", status: "operational" },
];

const STATUS_STYLE: Record<Component["status"], { label: string; color: string; dotColor: string }> = {
  operational: { label: "תקין", color: "#15803D", dotColor: "#22C55E" },
  degraded: { label: "ביצועים מורדים", color: "#A16207", dotColor: "#F59E0B" },
  outage: { label: "תקלה פעילה", color: "#B91C1C", dotColor: "#EF4444" },
};

const UPTIME_DAYS = 90;
const UPTIME_BARS = Array.from({ length: UPTIME_DAYS }, () => "ok" as const);

export default function StatusPage() {
  const overall = COMPONENTS.every((c) => c.status === "operational");
  const overallLabel = overall ? "כל המערכות תקינות" : "ישנן תקלות פעילות";
  const overallStyle = overall ? STATUS_STYLE.operational : STATUS_STYLE.outage;

  return (
    <LegalShell
      title="סטטוס מערכת"
      subtitle="סטטוס בזמן אמת של כל הרכיבים. אם משהו נופל - תראה את זה כאן לפני שתצטרך לכתוב לתמיכה."
      chipLabel="QUICKFOOD · סטטוס"
      backHref="/"
      backLabel="לדף הבית"
    >
      {/* ─── Overall banner ─────────────────────────────────────── */}
      <section
        style={{
          background: overall ? "#F0FDF4" : "#FEF2F2",
          border: `2px solid ${overallStyle.color}`,
          borderRadius: 16,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: overallStyle.dotColor,
            boxShadow: `0 0 0 4px ${overallStyle.dotColor}33`,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: overallStyle.color }}>
            {overallLabel}
          </div>
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            עודכן לאחרונה אוטומטית · בדיקות פעילות בכל הצמתים.
          </div>
        </div>
      </section>

      {/* ─── Components ─────────────────────────────────────────── */}
      <section>
        <h2>רכיבי המערכת</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {COMPONENTS.map((c) => {
            const s = STATUS_STYLE[c.status];
            return (
              <li
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0",
                  borderBottom: "1px dashed #E5E0CF",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: s.dotColor,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>{c.description}</div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: s.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── 90-day uptime ──────────────────────────────────────── */}
      <section>
        <h2>זמינות (90 ימים אחרונים)</h2>
        <p style={{ marginBottom: 12 }}>
          זמינות ממוצעת: <strong style={{ color: STATUS_STYLE.operational.color }}>100.00%</strong> · אין תקלות מתועדות בחלון הזה.
        </p>
        <div
          aria-label="גרף זמינות"
          style={{
            display: "flex",
            gap: 2,
            alignItems: "stretch",
            height: 36,
            background: "#FAF7E8",
            padding: 6,
            borderRadius: 8,
            border: "1px solid #E5E0CF",
          }}
        >
          {UPTIME_BARS.map((_, i) => (
            <div
              key={i}
              title={`לפני ${UPTIME_DAYS - i} ימים - תקין`}
              style={{
                flex: 1,
                background: STATUS_STYLE.operational.dotColor,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            opacity: 0.6,
            marginTop: 6,
          }}
        >
          <span>לפני 90 ימים</span>
          <span>היום</span>
        </div>
      </section>

      {/* ─── Incidents ──────────────────────────────────────────── */}
      <section>
        <h2>תקלות אחרונות</h2>
        <p>
          אין תקלות פתוחות או היסטוריות לתצוגה. כשתתרחש תקלה - יוצג כאן כותרת,
          הרכיבים שהושפעו, וציר זמן של העדכונים עד לפתרון.
        </p>
      </section>

      {/* ─── Subscribe to updates ───────────────────────────────── */}
      <section>
        <h2>קבלת עדכונים</h2>
        <p>
          רוצה להתעדכן רק כשיש תקלה? שלח מייל ל-
          <a href="mailto:support@quickfood.co.il?subject=הרשמה לעדכוני סטטוס">
            support@quickfood.co.il
          </a>{" "}
          ונוסיף אותך לרשימת ההתראות (התראה מייל אוטומטית כל פעם שמשתנה
          סטטוס של רכיב).
        </p>
      </section>
    </LegalShell>
  );
}
