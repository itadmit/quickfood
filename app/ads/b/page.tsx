"use client";

import { AdsShell, Check, BG_COLOR, INK_COLOR } from "../_components/AdsShell";

const ITEMS = [
  "אתר הזמנות ממותג",
  "מעקב משלוחים בזמן אמת",
  "אפליקציית שליחים",
  "0.5% עמלה בלבד",
];

export default function AdsPageB() {
  return (
    <AdsShell>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: "clamp(34px,10vw,48px)",
          fontWeight: 900, lineHeight: 1.1,
          color: INK_COLOR, letterSpacing: "-1.5px",
          marginBottom: 12,
        }}>
          כמה שילמת לוולט<br />החודש?
        </h1>
        <p style={{
          fontSize: 15, color: "rgba(0,0,0,0.68)",
          fontWeight: 500, lineHeight: 1.55,
        }}>
          עכשיו תדמיין שכל הלקוחות החוזרים שלך מזמינים ישירות מהאתר שלך.
        </p>
      </div>

      <ul style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {ITEMS.map((item) => (
          <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 15, fontWeight: 600, color: INK_COLOR }}>
            <Check />
            {item}
          </li>
        ))}
      </ul>

      {/* Price */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 6,
        background: "rgba(0,0,0,0.07)",
        border: "1.5px solid rgba(0,0,0,0.12)",
        borderRadius: 14, padding: "12px 18px",
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 38, fontWeight: 900, color: INK_COLOR, letterSpacing: "-1.5px", lineHeight: 1 }}>
          ₪299
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: INK_COLOR }}>
          לחודש + 0.5% בלבד
        </span>
      </div>

      {/* Tagline */}
      <p style={{
        fontSize: 13, fontWeight: 700, color: INK_COLOR,
        textAlign: "center", marginBottom: 14, letterSpacing: "-0.2px",
      }}>
        הלקוחות שלך. ההזמנות שלך. האתר שלך.
      </p>

      <button style={{
        width: "100%", padding: "17px",
        background: INK_COLOR, color: BG_COLOR,
        fontSize: 17, fontWeight: 800,
        border: "none", borderRadius: 999,
        cursor: "pointer", letterSpacing: "-0.2px",
        fontFamily: "inherit",
        boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <svg style={{ animation: "swipeUp 1.5s ease-in-out infinite", flexShrink: 0 }}
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={BG_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
        החליקו למעלה לפרטים נוספים
      </button>
      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 10, fontWeight: 500 }}>
        7 ימי ניסיון עלינו · ללא כרטיס אשראי · ללא התחייבות
      </p>
    </AdsShell>
  );
}
