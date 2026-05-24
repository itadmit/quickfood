"use client";

import { useEffect, useState } from "react";

/**
 * Marketing one-liner above the auth form. Picks a different line from
 * the bank on each mount so a returning merchant sees a fresh pitch
 * every visit, and so the screen never feels static across pageloads.
 *
 * Lines are kept short (1 line, ~max 50 chars) so the layout doesn't
 * shift between picks. SSR renders a fixed first entry to avoid
 * hydration mismatch; the client swap happens immediately in
 * useEffect.
 */
const TAGLINES = [
  "לא חבל על כל העמלות? הגיע הזמן לעבור לקוויקפוד.",
  "אתם עדיין מוכרים רק בוולט? חבל.",
  "5 דקות ויש לכם אתר הזמנות משלכם.",
  "למה לשלם עמלות על כל הזמנה?",
  "כל הזמנה ישירות אליכם. בלי מתווכים.",
  "הלקוחות שלכם. הרווח שלכם.",
  "מסעדה מצליחה צריכה אתר הזמנות משלה.",
  "תפסיקו לשלם יותר. תתחילו להרוויח יותר.",
  "אתר הזמנות מקצועי בדקות בודדות.",
  "קחו בחזרה את השליטה על ההזמנות.",
  "יותר רווח מכל הזמנה.",
  "הזמנות ישירות מהלקוחות שלכם.",
  "בונים אתר. מתחילים למכור.",
  "הדרך הקצרה להזמנות אונליין.",
  "פחות עמלות. יותר רווח.",
  "כל ההזמנות במקום אחד.",
  "אתר משלכם. מותג משלכם.",
  "למה לקדם מותג אחר במקום את שלכם?",
  "אל תתנו לעמלות לאכול את הרווח.",
  "עברו להזמנות ישירות עוד היום.",
  "פיצה, המבורגר, סושי או שווארמה? אנחנו כבר מוכנים.",
  "כל מה שהמסעדה שלכם צריכה כדי למכור אונליין.",
  "פותחים אתר הזמנות תוך דקות.",
  "הלקוחות מחפשים אתכם. תנו להם להזמין ישירות.",
  "הגיע הזמן שהמסעדה תעבוד בשבילכם.",
];

export function AuthRotatingTagline() {
  // SSR with index 0 → deterministic markup. After mount, pick a random
  // line. Length is bounded ≥ 1 so this index is always safe.
  const [text, setText] = useState<string>(TAGLINES[0]);

  useEffect(() => {
    setText(TAGLINES[Math.floor(Math.random() * TAGLINES.length)]);
  }, []);

  return (
    <h2
      className="text-2xl lg:text-3xl font-black leading-tight text-black drop-shadow-[0_2px_0_rgba(255,255,255,0.4)]"
      // dir="rtl" inherits from <html>; explicit here only to make the
      // intent unambiguous when the line gets re-used elsewhere.
      dir="rtl"
    >
      {text}
    </h2>
  );
}
