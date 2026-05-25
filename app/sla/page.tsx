import { LegalShell } from "@/components/shared/LegalShell";

export const metadata = {
  title: "הסכם רמת שירות (SLA) - QuickFood",
  description:
    "התחייבות QuickFood לזמינות, זמני תגובה, חלונות תחזוקה, וזיכויים במקרה של חריגה. מסמך מחייב לכל המסעדנים בתוכנית בתשלום.",
};

export default function SlaPage() {
  return (
    <LegalShell
      title="הסכם רמת שירות (SLA)"
      subtitle="ההתחייבות שלנו לזמינות הפלטפורמה, זמני תגובה לתקלות, חלונות תחזוקה, וזיכויים במקרה של חריגה."
      lastUpdated="2026-05-24"
      chipLabel="QUICKFOOD · SLA"
      backHref="/"
      backLabel="לדף הבית"
    >
      <section>
        <h2>1. הגדרות</h2>
        <ul>
          <li>
            <strong>השירות</strong> - פלטפורמת QuickFood: הדשבורד, ה-API, חנות
            ההזמנות של הלקוח (storefront), Webhooks, ושליחת SMS/WhatsApp.
          </li>
          <li>
            <strong>זמינות חודשית</strong> - אחוז הדקות בחודש קלנדרי שבהן
            השירות הגיב בהצלחה לקריאה (HTTP 2xx) תוך פחות מ-5 שניות.
          </li>
          <li>
            <strong>אירוע השבתה</strong> - חלון רציף של 5 דקות ומעלה שבו לפחות
            50% מהקריאות נכשלו או חרגו מ-5 שניות, ולא מסיבה שבחבילת ה-Excluded
            (סעיף 5).
          </li>
          <li>
            <strong>חבילה בסיסית</strong> - מנוי QuickFood Base (₪299/חודש).
          </li>
        </ul>
      </section>

      <section>
        <h2>2. התחייבות זמינות</h2>
        <p>QuickFood מתחייבת לזמינות חודשית של <strong>99.9%</strong> לכל אחד מהרכיבים הבאים:</p>
        <table>
          <thead>
            <tr><th>רכיב</th><th>יעד</th><th>פעולת חירום</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>חנות לקוח (storefront)</td>
              <td>99.9%</td>
              <td>עדיפות עליונה - הלקוחות לא יכולים להזמין</td>
            </tr>
            <tr>
              <td>API (Webhooks + Inbound)</td>
              <td>99.9%</td>
              <td>קופות לא יכולות לסנכרן</td>
            </tr>
            <tr>
              <td>דשבורד מסעדן</td>
              <td>99.5%</td>
              <td>מטבח עובד דרך SSE - יותר חסין</td>
            </tr>
            <tr>
              <td>מערכת SMS/WhatsApp</td>
              <td>99.0%</td>
              <td>תלוי בספקים חיצוניים (sms4free, iBot)</td>
            </tr>
          </tbody>
        </table>
        <div className="docs-callout">
          <strong>99.9% פירושו:</strong> עד 43 דקות השבתה לכל רכיב בחודש של 30 ימים. עד 8 שעות בשנה.
        </div>
      </section>

      <section>
        <h2>3. תגובה לתקלות</h2>
        <table>
          <thead>
            <tr><th>חומרה</th><th>הגדרה</th><th>זמן תגובה ראשוני</th><th>זמן פתרון יעד</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>P0 - קריטי</strong></td>
              <td>חנות הלקוח לא עובדת לכלל המסעדנים, או אבדן נתונים פעיל</td>
              <td>15 דקות, 24/7</td>
              <td>2 שעות</td>
            </tr>
            <tr>
              <td><strong>P1 - גבוה</strong></td>
              <td>פיצ&apos;ר מרכזי מושבת (סליקה, Webhooks, SMS) או חנות יחידה תקועה</td>
              <td>1 שעה בשעות עבודה, 4 שעות בלילה</td>
              <td>יום עבודה אחד</td>
            </tr>
            <tr>
              <td><strong>P2 - בינוני</strong></td>
              <td>פיצ&apos;ר משני לא עובד, אבל יש workaround</td>
              <td>יום עבודה אחד</td>
              <td>שבוע</td>
            </tr>
            <tr>
              <td><strong>P3 - נמוך</strong></td>
              <td>תקלה קוסמטית, בקשה לשיפור, שאלה כללית</td>
              <td>שלושה ימי עבודה</td>
              <td>לפי roadmap</td>
            </tr>
          </tbody>
        </table>
        <h3>שעות עבודה</h3>
        <p>
          ימים א-ה, 09:00-18:00 שעון ישראל. ערבי חג עד 13:00. שישי, שבת וחגים -
          רק תקלות P0 מטופלות.
        </p>
      </section>

      <section>
        <h2>4. חלונות תחזוקה מתוכננים</h2>
        <p>
          תחזוקה מתוכננת מבוצעת בחלון <strong>שלישי 03:00-05:00 שעון ישראל</strong>,
          השעה הכי שקטה במערכת. ההשבתה הזו <em>לא</em> נחשבת במדידת ה-99.9%.
        </p>
        <ul>
          <li>הודעה מוקדמת של 48 שעות לכל חלון תחזוקה</li>
          <li>תחזוקת חירום (security patches) - הודעה של עד שעה</li>
          <li>תחזוקה לא מתוכננת מעבר לחלון - נחשבת השבתה ומזכה ב-credit</li>
        </ul>
      </section>

      <section>
        <h2>5. מה לא נכלל ב-SLA (Excluded)</h2>
        <p>הזמינות לא נמדדת, ולא ניתן זיכוי, על תקופות שבהן ההשבתה נובעת מ:</p>
        <ul>
          <li>חלון תחזוקה מתוכנן שהודיע עליו 48 שעות מראש</li>
          <li>תקלה בספק תשתית חיצוני (Vercel, Neon, Cloudflare) שגם הם פרסמו במצב המערכת שלהם</li>
          <li>תקלה בספק צד שלישי שהמסעדן בחר (Grow Payments, sms4free, iBot Chat)</li>
          <li>הגדרה שגויה בצד המסעדן (DNS לדומיין מותאם, מפתח Grow לא תקין)</li>
          <li>שימוש לרעה / חריגה ממכסות ה-Rate Limit (סעיף 8 ב-API Docs)</li>
          <li>כוח עליון: שביתה כללית, מלחמה, אירועי סייבר ברמת מדינה</li>
        </ul>
      </section>

      <section>
        <h2>6. זיכויים (Service Credits)</h2>
        <p>
          אם הזמינות בחודש קלנדרי נופלת מהיעד של 99.9%, המסעדן זכאי לזיכוי
          מהמנוי החודשי הבסיסי לפי הטבלה:
        </p>
        <table>
          <thead>
            <tr><th>זמינות בפועל</th><th>זיכוי</th></tr>
          </thead>
          <tbody>
            <tr><td>99.0% עד 99.89%</td><td>10% מהמנוי</td></tr>
            <tr><td>95.0% עד 98.99%</td><td>25% מהמנוי</td></tr>
            <tr><td>90.0% עד 94.99%</td><td>50% מהמנוי</td></tr>
            <tr><td>פחות מ-90.0%</td><td>100% מהמנוי</td></tr>
          </tbody>
        </table>
        <h3>איך מקבלים זיכוי</h3>
        <ol>
          <li>שולחים מייל ל-<a href="mailto:support@quickfood.co.il">support@quickfood.co.il</a> תוך 30 ימים מסוף החודש</li>
          <li>מציינים את תאריכי האירועים והשעות (מהדשבורד שלכם או מ-status.quickfood.co.il)</li>
          <li>אנחנו מאמתים מול הלוגים שלנו ומחזירים תשובה תוך 5 ימי עבודה</li>
          <li>זיכוי שאושר מקוזז אוטומטית מהחיוב של החודש הבא</li>
        </ol>
        <div className="docs-callout">
          <strong>תקרה:</strong> זיכוי מקסימלי לחודש = 100% מהמנוי. אין החזר בכסף - רק קיזוז עתידי.
          לא ניתן לצבור זיכויים בין חודשים.
        </div>
      </section>

      <section>
        <h2>7. שקיפות - דף Status</h2>
        <p>
          מצב המערכת בזמן אמת זמין ב-<a href="https://status.quickfood.co.il">status.quickfood.co.il</a> -
          uptime היסטורי, אירועים פעילים, חלונות תחזוקה מתוכננים. אפשר להירשם
          להתראות SMS/מייל על אירועים שמשפיעים על המסעדה שלכם.
        </p>
      </section>

      <section>
        <h2>8. שינויים ב-SLA</h2>
        <p>
          QuickFood רשאית לעדכן את ה-SLA. שינויים מהותיים (הורדת יעדים, הגבלת
          זיכויים) ייכנסו לתוקף 60 ימים אחרי הודעה במייל ובדשבורד, ולא יחולו
          רטרואקטיבית. שיפורים (הגדלת יעדים) חלים מיידית.
        </p>
      </section>
    </LegalShell>
  );
}
