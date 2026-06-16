"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

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
      {open && <WoltTermsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function WoltTermsGateModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return <WoltTermsDialog gate onConfirm={onConfirm} onClose={onClose} />;
}

function WoltTermsDialog({
  gate = false,
  onConfirm,
  onClose,
}: {
  gate?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [readAll, setReadAll] = useState(!gate);

  const trackScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 8) {
      setProgress(100);
      setReadAll(true);
      return;
    }
    const pct = Math.min(100, Math.round((el.scrollTop / max) * 100));
    setProgress((p) => Math.max(p, pct));
    if (el.scrollTop >= max - 24) setReadAll(true);
  }, []);

  useEffect(() => {
    if (!gate) return;
    trackScroll();
    window.addEventListener("resize", trackScroll);
    return () => window.removeEventListener("resize", trackScroll);
  }, [gate, trackScroll]);

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

  function scrollMore() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
  }

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
            {gate
              ? "רגע לפני הייבוא - אישור בעלות על התוכן"
              : "ייבוא תוכן מוולט - אחריות ושימוש"}
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

        {gate && (
          <div className="h-1.5 bg-black/10 shrink-0" aria-hidden>
            <div
              className="h-full bg-black transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="relative flex flex-col min-h-0">
          <div
            ref={scrollRef}
            onScroll={gate ? trackScroll : undefined}
            className="overflow-y-auto px-5 py-5 text-sm text-black/85 leading-relaxed space-y-3"
          >
            <p>
              הפלטפורמה מציעה כלי נוחות לייבוא נתוני חנות מ-Wolt - שם העסק,
              כתובת, טלפון, שעות פעילות, לוגו, תמונת כריכה, קטגוריות, פריטים,
              תמונות ומחירים - לחנות שלך ב-Quick Food. הייבוא מותנה באישור
              מפורש שלך לפיו אתה בעל החנות והתכנים שייכים לך.
            </p>
            <p>
              <strong>Quick Food אינה קשורה ל-Wolt</strong>, אינה משויכת אליה,
              ואינה פועלת מטעמה. אנו רק מעבירים נתונים שאתה - בעל החנות -
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
                אתה מצהיר כי אתה בעל הזכויות או מחזיק בהרשאה חוקית להשתמש בכל
                התוכן המיובא. אם תוכן מסוים הופק עבורך על ידי Wolt או צלם מטעמה
                בכפוף להסכם בלעדיות - אל תייבא אותו.
              </li>
              <li>
                האחריות לוודא כי השימוש בנתונים ובתוכן עומד בתנאי השימוש של Wolt
                ובכל הסכם החל על בית העסק חלה על בעל העסק בלבד.
              </li>
              <li>
                אתה אחראי באופן בלעדי לכל טענה, תביעה, מחלוקת חוזית, או
                דרישה של Wolt, של ספקיה, של צלמים, או של כל צד שלישי בקשר
                עם הייבוא או השימוש בתוכן - לרבות הפרת זכויות יוצרים, סימני
                מסחר, הסכמי בלעדיות, או תנאי שירות של Wolt.
              </li>
              <li>
                Quick Food לא תישא בכל אחריות לנזקים ישירים או עקיפים שייגרמו
                לך או לצד שלישי בקשר עם הפעולה הזו, ואינה מתחייבת לשלמות,
                דיוק, עדכניות או זמינות הנתונים שיתקבלו מ-Wolt.
              </li>
              <li>
                אם מסיבה כלשהי תידרש Quick Food להשיב נזק לצד שלישי בקשר עם
                ייבוא שביצעת - אתה תשפה את החברה במלוא הסכום, לרבות הוצאות
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

          {gate && !readAll && (
            <button
              type="button"
              onClick={scrollMore}
              aria-label="גלילה להמשך הקריאה"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#F8CB1E] border-2 border-black grid place-items-center shadow-[0_3px_0_#000] animate-bounce"
            >
              <ChevronDown size={18} strokeWidth={2.8} className="text-black" />
            </button>
          )}
        </div>

        <footer
          className={cn(
            "px-5 py-3 border-t-2 border-black bg-[#FFFBEC] flex items-center gap-3",
            gate ? "justify-between" : "justify-end",
          )}
        >
          {gate ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-bold text-black/60 hover:text-black"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={!readAll}
                onClick={onConfirm}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-black border-2 transition inline-flex items-center gap-2",
                  readAll
                    ? "bg-[#F8CB1E] hover:bg-[#ffd84a] text-black border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000]"
                    : "bg-black/10 text-black/45 border-black/30 cursor-not-allowed",
                )}
              >
                {readAll ? (
                  <>
                    <Check size={16} strokeWidth={2.8} />
                    <span>קראתי ואני מאשר/ת - התוכן שלי</span>
                  </>
                ) : (
                  <>
                    <span>גללו עד הסוף לאישור</span>
                    <ChevronDown size={16} strokeWidth={2.8} />
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-black text-[#F8CB1E] font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
            >
              הבנתי
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
