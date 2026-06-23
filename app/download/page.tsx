import { LegalShell } from "@/components/shared/LegalShell";
import { DownloadCards } from "@/app/_components/DownloadCards";

export const metadata = {
  title: "הורדת האפליקציה - QuickFood",
  description:
    "הורידו את אפליקציית QuickFood לעמדת הקופה - Windows, macOS ו-Android. עמדת קיוסק או לוח בקרה במסך מלא, מותקנת בקליק.",
};

export default function DownloadPage() {
  return (
    <LegalShell
      title="הורדת האפליקציה"
      subtitle="עמדת קופה במסך מלא - לוח הבקרה והקיוסק של QuickFood כאפליקציה מותקנת. בוחרים מערכת הפעלה, מתקינים, ומגדירים פעם אחת."
      chipLabel="QUICKFOOD · הורדות"
      backHref="/dashboard/settings/kiosk"
      backLabel="להגדרות"
    >
      <section>
        <DownloadCards />
      </section>

      <section>
        <h2>מה מקבלים</h2>
        <ul>
          <li><strong>מסך מלא נעול:</strong> האפליקציה עולה ישר לקיוסק או ללוח הבקרה, בלי סרגלי דפדפן ובלי הסחות דעת.</li>
          <li><strong>הגדרה פעם אחת:</strong> בהפעלה הראשונה מזינים את מזהה החנות, וזה נשמר לתמיד.</li>
          <li><strong>עובד גם על מחשבים ישנים:</strong> גרסת Windows תומכת ב-Windows 7 ומעלה.</li>
          <li><strong>שמירת התחברות:</strong> מתחברים פעם אחת והעמדה נשארת מחוברת.</li>
        </ul>
      </section>

      <section>
        <h2>התקנה</h2>
        <ul>
          <li><strong>Windows:</strong> מורידים את קובץ ההתקנה, מריצים, ומאשרים. קיצור דרך נוצר בשולחן העבודה.</li>
          <li><strong>macOS:</strong> פותחים את קובץ ה-DMG וגוררים את QuickFood לתיקיית האפליקציות.</li>
          <li><strong>Android:</strong> מורידים את ה-APK, מאשרים התקנה ממקור לא מזוהה, ומתקינים.</li>
        </ul>
      </section>
    </LegalShell>
  );
}
