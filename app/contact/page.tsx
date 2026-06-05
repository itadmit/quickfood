import { LegalShell } from "@/components/shared/LegalShell";
import { LeadForm } from "@/components/marketing/LeadForm";

export const metadata = {
  title: "צור קשר - QuickFood",
  description:
    "דרכי יצירת קשר עם QuickFood - תמיכה למסעדנים קיימים, ופניות עסקיות. מענה אנושי בעברית בשעות עבודה.",
};

export default function ContactPage() {
  return (
    <LegalShell
      title="צור קשר"
      subtitle="כל הדרכים להגיע אלינו. מענה אנושי בעברית, בלי בוטים בלי תור, ובלי 'נציג יחזור אליך'."
      chipLabel="QUICKFOOD · צרו קשר"
      backHref="/"
      backLabel="לדף הבית"
    >
      <section className="not-prose">
        <LeadForm
          source="contact"
          heading="השאר פרטים, נחזור אליך"
          subheading="הדרך המהירה ביותר לקבל תשובה - תוך יום עבודה. בלי בוטים, בלי שיחת מכירה."
          submitLabel="שליחה"
        />
      </section>

      <section>
        <h2>לאיזה צורך?</h2>
        <table>
          <thead>
            <tr><th>בשביל מה</th><th>איך</th><th>זמן תגובה</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>תמיכה למסעדנים קיימים, חיוב, חשבוניות, החזרים, SLA, פניות משפטיות (DPA, GDPR), פרטיות</td>
              <td><a href="mailto:support@quickfood.co.il">support@quickfood.co.il</a></td>
              <td>תוך יום עבודה</td>
            </tr>
            <tr>
              <td>שאלות לפני רישום, מכירות, אינטגרציות (קופות, Make, Zapier), קריירה, עיתונאות</td>
              <td><a href="mailto:hello@quickfood.co.il">hello@quickfood.co.il</a></td>
              <td>תוך 2 ימי עבודה</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>שעות עבודה</h2>
        <ul>
          <li><strong>ימים א-ה:</strong> 09:00-18:00</li>
          <li><strong>ערבי חג:</strong> 09:00-13:00</li>
          <li><strong>שישי, שבת, חגים:</strong> רק תקלות P0 (השבתה כללית) - לפי <a href="/sla">ה-SLA</a></li>
        </ul>
      </section>

      <section>
        <h2>תמיכה בוואטסאפ</h2>
        <p>
          מסעדנים פעילים יכולים לפנות גם בוואטסאפ למספר{" "}
          <strong dir="ltr">+972-50-000-0000</strong> (יוצב על ידי הצוות בקרוב).
          מענה רק בשעות עבודה - מחוץ לזה תקבלו אישור אוטומטי וטיפול במוצ&apos;ש.
        </p>
      </section>

      <section>
        <h2>כתובת רשומה</h2>
        <p>
          <strong>Quickshop Ltd</strong>
          <br />
          תל אביב, ישראל
          <br />
          ע&quot;מ: יוסף עם פתיחת חשבון העסק.
        </p>
        <p>
          לפניות פיזיות (חשבוניות נייר, מסמכים חתומים) - שלחו תחילה מייל כדי
          לתאם, אנחנו עובדים דיגיטלית.
        </p>
      </section>

      <section>
        <h2>סטטוס המערכת</h2>
        <p>
          לפני שאתם מדווחים על תקלה, שווה לבדוק את{" "}
          <a href="/status">עמוד סטטוס המערכת</a> - ייתכן שכבר אנחנו מטפלים
          בה ומספקים עדכון בזמן אמת.
        </p>
      </section>
    </LegalShell>
  );
}
