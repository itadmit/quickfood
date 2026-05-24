import { LegalShell } from "@/components/shared/LegalShell";

export const metadata = {
  title: "בלוג - QuickFood",
  description:
    "תובנות, מספרים מהשטח, וסיפורי מסעדות שעברו לעצמאות דיגיטלית. הבלוג של QuickFood עולה בקרוב.",
};

export default function BlogPage() {
  return (
    <LegalShell
      title="הבלוג"
      subtitle="כאן יעלו פוסטים על הצד העסקי של מסעדנות עצמאית - מספרים מהשטח, השוואות מעמיקות מול אגרגטורים, ומקרי בוחן של מסעדות שעברו לדומיין שלהן."
      chipLabel="QUICKFOOD · בלוג"
      backHref="/"
      backLabel="לדף הבית"
    >
      <section>
        <h2>בקרוב</h2>
        <p>
          הבלוג בעבודה. הפוסטים הראשונים יעסקו בנושאים האלה:
        </p>
        <ul>
          <li>כמה באמת עולה Wolt - חישוב מלא של עמלות, אחוזים נסתרים, ועלות הסתרת הלקוח</li>
          <li>איך לבנות תפריט דיגיטלי שמוכר יותר - מודיפיירים, אפ-סלים, ותמונות</li>
          <li>אוטומציות מנצחות עם Make ו-Zapier - מהזמנה לקבלה לדוח חודשי</li>
          <li>case studies של מסעדנים שעברו מאגרגטור לחנות עצמאית - מה השתנה בהכנסות</li>
        </ul>
      </section>

      <section>
        <h2>רוצים לקבל הודעה כשעולה הפוסט הראשון?</h2>
        <p>
          שלחו לנו מייל ל-<a href="mailto:blog@quickfood.co.il?subject=הירשם לבלוג">blog@quickfood.co.il</a>{" "}
          ונוסיף אתכם לרשימת תפוצה (לא ספאם, פוסט אחד בחודש בערך).
        </p>
      </section>

      <section>
        <h2>יש לכם רעיון לפוסט?</h2>
        <p>
          אם יש נושא שאתם רוצים שנעמיק בו - עמלות, KPI, אופטימיזציה של תפריט,
          UX של checkout, הפעלת SMS marketing - תכתבו לנו ל-
          <a href="mailto:blog@quickfood.co.il">blog@quickfood.co.il</a>.
        </p>
      </section>
    </LegalShell>
  );
}
