import { LegalShell } from "@/components/shared/LegalShell";

export const metadata = {
  title: "צור קשר - QuickFood",
  description:
    "דרכי יצירת קשר עם QuickFood - תמיכה, מכירות, אינטגרציה, חיוב, ופנייה משפטית. מענה אנושי בעברית בשעות עבודה.",
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
      <section>
        <h2>לאיזה צורך?</h2>
        <table>
          <thead>
            <tr><th>בשביל מה</th><th>איך</th><th>זמן תגובה</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>תמיכה למסעדנים קיימים</td>
              <td><a href="mailto:support@quickfood.co.il">support@quickfood.co.il</a></td>
              <td>תוך 4 שעות בימי עבודה</td>
            </tr>
            <tr>
              <td>שאלות לפני רישום / מכירות</td>
              <td><a href="mailto:hello@quickfood.co.il">hello@quickfood.co.il</a></td>
              <td>תוך יום עבודה</td>
            </tr>
            <tr>
              <td>אינטגרציה (קופות, Make, Zapier)</td>
              <td><a href="mailto:dev@quickfood.co.il">dev@quickfood.co.il</a></td>
              <td>תוך 2 ימי עבודה</td>
            </tr>
            <tr>
              <td>חיוב, חשבוניות, החזרים</td>
              <td><a href="mailto:billing@quickfood.co.il">billing@quickfood.co.il</a></td>
              <td>תוך יום עבודה</td>
            </tr>
            <tr>
              <td>SLA / הצהרת השבתה</td>
              <td><a href="mailto:sla@quickfood.co.il">sla@quickfood.co.il</a></td>
              <td>5 ימי עבודה</td>
            </tr>
            <tr>
              <td>פנייה משפטית, DPA, GDPR</td>
              <td><a href="mailto:legal@quickfood.co.il">legal@quickfood.co.il</a></td>
              <td>תוך שבוע עבודה</td>
            </tr>
            <tr>
              <td>קריירה, מועמדות</td>
              <td><a href="mailto:jobs@quickfood.co.il">jobs@quickfood.co.il</a></td>
              <td>תוך שבוע</td>
            </tr>
            <tr>
              <td>עיתונאות, בלוגרים</td>
              <td><a href="mailto:press@quickfood.co.il">press@quickfood.co.il</a></td>
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
          <a href="https://status.quickfood.co.il">status.quickfood.co.il</a> -
          ייתכן שכבר אנחנו מטפלים בה ומספקים עדכון בזמן אמת.
        </p>
      </section>
    </LegalShell>
  );
}
