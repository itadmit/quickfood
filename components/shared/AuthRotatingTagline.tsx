"use client";

import { useEffect, useState } from "react";

/**
 * Marketing one-liner above the auth form. Cycles through a bank of
 * pitches every 4.5s with a roll-up + blur-in animation so the screen
 * feels alive and a returning merchant sees a different angle each
 * pass. Initial pick is randomised after mount so two tabs don't
 * march in lockstep.
 *
 * Lines are kept short (1 short sentence, ~50 chars) so the layout
 * doesn't shift between picks; the wrapping h2 carries a
 * `min-height` set in `em` units that fits the longest line.
 */
const TAGLINES = [
  "הלקוח הקבוע - הוא הרווח האמיתי. שמרו אותו אצלכם.",
  "פיצה, המבורגר, סושי, שווארמה - אנחנו מוכנים.",
  "אתר הזמנות מקצועי בדקות בודדות.",
  "המותג שלכם, הדומיין שלכם, הלקוחות שלכם.",
  "תוספות, גדלים, חצי-חצי - הכל בקופה אחת.",
  "פותחים אתר עוד היום. בלי כרטיס אשראי.",
  "תפריט שלכם, מוצרים שלכם, חוויית הזמנה שלכם.",
  "5 דקות - ויש לכם אתר הזמנות משלכם.",
];

const ROTATE_MS = 4500;

export function AuthRotatingTagline() {
  // Start with index 0 for deterministic SSR; randomise + start the
  // cycle after mount so different sessions get different first lines.
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * TAGLINES.length));
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TAGLINES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative overflow-hidden min-h-[3.2em] lg:min-h-[2.8em]"
      dir="rtl"
    >
      {/* `key={index}` re-triggers the CSS keyframe on every swap.
          Previous text unmounts instantly - the animation duration
          (~620ms) is short enough that the gap reads as "snappy"
          rather than "broken". */}
      <h2
        key={index}
        className="text-2xl lg:text-3xl font-black leading-tight text-black animate-tagline-roll"
      >
        {TAGLINES[index]}
      </h2>
    </div>
  );
}
