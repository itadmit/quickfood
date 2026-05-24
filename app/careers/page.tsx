import { LegalShell } from "@/components/shared/LegalShell";

export const metadata = {
  title: "קריירה - QuickFood",
  description:
    "אנחנו צוות קטן בתל אביב שמייצר תוכנת SaaS למסעדות. אין משרות פתוחות כרגע, אבל אם אתם מתאימים - כתבו לנו ונעדכן.",
};

export default function CareersPage() {
  return (
    <LegalShell
      title="קריירה ב-QuickFood"
      subtitle="צוות קטן, מוצר אמיתי בידיים של בעלי מסעדות אמיתיים. בלי שכבות, בלי בולשיט, בלי תפקידים מומצאים."
      chipLabel="QUICKFOOD · קריירה"
      backHref="/"
      backLabel="לדף הבית"
    >
      <section>
        <h2>איך אנחנו עובדים</h2>
        <ul>
          <li><strong>צוות מצומצם:</strong> מי שכותב את הקוד גם מדבר עם המסעדנים. אין PM באמצע.</li>
          <li><strong>מרחוק או בתל אביב:</strong> משרד שקט בלב העיר, אבל ימי בית מותרים.</li>
          <li><strong>מוצר אמיתי:</strong> כל שורה שאתם כותבים מגיעה לקופה של מסעדה תוך שבוע.</li>
          <li><strong>בלי oncall:</strong> יש לנו monitoring טוב + יחס בריא לחיים מחוץ לעבודה.</li>
          <li><strong>שכר:</strong> תחרותי + שאלת אופציות פתוחה לדיון.</li>
        </ul>
      </section>

      <section>
        <h2>משרות פתוחות</h2>
        <div className="docs-callout">
          <strong>אין משרות פתוחות כרגע.</strong> אם זה לא ירדע אתכם וחושבים שאתם מתאימים לצוות הזה -
          שלחו לנו מייל עם CV ו-2 משפטים על למה QuickFood. אנחנו קוראים הכל, ועונים תוך שבוע.
        </div>
        <p>
          <a
            href="mailto:jobs@quickfood.co.il?subject=מועמדות עתידית - QuickFood"
            className="font-black"
          >
            jobs@quickfood.co.il
          </a>
        </p>
      </section>

      <section>
        <h2>למה לעבוד כאן (ולמה לא)</h2>
        <h3>זה מתאים לכם אם:</h3>
        <ul>
          <li>אתם רוצים לבנות מוצר ממש, לא להוסיף עוד בקלייט לדאשבורד פנימי</li>
          <li>אתם נהנים לכתוב קוד שאחרים יקראו (PRs, design docs, code review)</li>
          <li>אתם רוצים לראות בעלי עסקים אמיתיים משתמשים במה שעשיתם</li>
          <li>אתם בסדר עם startup קטן - גם הצדדים הפחות זוהרים שלו (פיקוס, אחריות, להחליט בעצמכם)</li>
        </ul>
        <h3>זה לא מתאים לכם אם:</h3>
        <ul>
          <li>אתם מחפשים חברה גדולה עם career-ladder ברור</li>
          <li>אתם רוצים תפקיד צר (רק backend, רק UI, רק data)</li>
          <li>אתם לא נהנים לדבר ישירות עם משתמשי קצה</li>
        </ul>
      </section>
    </LegalShell>
  );
}
