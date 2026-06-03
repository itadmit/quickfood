"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function WoltTermsTrigger({
  className,
  children = "תנאי השימוש",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className ?? "underline font-bold"}
      >
        {children}
      </button>
      {open && <WoltTermsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function WoltTermsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wolt-terms-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl border-2 border-black shadow-[0_6px_0_#000] overflow-hidden flex flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b-2 border-black bg-[#FFF6CC]">
          <h2 id="wolt-terms-title" className="text-base sm:text-lg font-black text-black">
            ייבוא תוכן מוולט — אחריות ושימוש
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="shrink-0 w-9 h-9 rounded-full bg-white border-2 border-black grid place-items-center hover:bg-[#F8CB1E] transition active:translate-y-px"
          >
            <X size={16} strokeWidth={2.8} className="text-black" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 text-sm text-black/85 leading-relaxed space-y-3">
          <p>
            הפלטפורמה מציעה כלי נוחות לייבוא נתוני חנות מ-Wolt — שם העסק,
            כתובת, טלפון, שעות פעילות, לוגו, תמונת כריכה, קטגוריות, פריטים,
            תמונות ומחירים — לחנות שלך ב-Quick Food. הייבוא מותנה בסימון
            מפורש של תיבת אישור לפיה אתה בעל החנות והתכנים שייכים לך.
          </p>
          <p>
            <strong>Quick Food אינה קשורה ל-Wolt</strong>, אינה משויכת אליה,
            ואינה פועלת מטעמה. אנו רק מעבירים נתונים שאתה — בעל החנות —
            ביקשת להעתיק לחשבון שלך אצלנו. השימוש בכלי הזה הוא{" "}
            <strong>באחריותך הבלעדית</strong>:
          </p>
          <ul className="list-disc ps-5 space-y-2">
            <li>
              אתה מצהיר שאתה הבעלים של החנות ב-Wolt שאת כתובתה הדבקת, ושכל
              התוכן שייובא (לרבות תמונות, שמות פריטים, תיאורים ומחירים)
              שייך לך או שניתנה לך הרשאה מלאה לעשות בו שימוש מסחרי.
            </li>
            <li>
              אתה אחראי באופן בלעדי לכל טענה, תביעה, מחלוקת חוזית, או
              דרישה של Wolt, של ספקיה, של צלמים, או של כל צד שלישי בקשר
              עם הייבוא או השימוש בתוכן — לרבות הפרת זכויות יוצרים, סימני
              מסחר, הסכמי בלעדיות, או תנאי שירות של Wolt.
            </li>
            <li>
              Quick Food לא תישא בכל אחריות לנזקים ישירים או עקיפים שייגרמו
              לך או לצד שלישי בקשר עם הפעולה הזו, ואינה מתחייבת לשלמות,
              דיוק, עדכניות או זמינות הנתונים שיתקבלו מ-Wolt.
            </li>
            <li>
              אם מסיבה כלשהי תידרש Quick Food להשיב נזק לצד שלישי בקשר עם
              ייבוא שביצעת — אתה תשפה את החברה במלוא הסכום, לרבות הוצאות
              משפטיות סבירות.
            </li>
          </ul>
          <p>
            אם אינך הבעלים של החנות, או שאינך בטוח שהתוכן שייך לך, אנא אל
            תשתמש בכלי הייבוא. ניתן לבנות את התפריט ידנית בעורך התפריט שלנו.
          </p>
          <p className="text-xs text-black/55 pt-2 border-t border-black/10">
            הסעיף הזה הוא חלק מ-
            <a
              href="/terms#wolt-import"
              target="_blank"
              rel="noopener"
              className="underline font-bold"
              onClick={(e) => e.stopPropagation()}
            >
              תנאי השימוש המלאים
            </a>
            {" "}של Quick Food.
          </p>
        </div>

        <footer className="px-5 py-3 border-t-2 border-black bg-[#FFFBEC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-black text-[#F8CB1E] font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
          >
            הבנתי
          </button>
        </footer>
      </div>
    </div>
  );
}
