"use client";

import { AdsShell, Check, BG_COLOR, INK_COLOR } from "./_components/AdsShell";

const ITEMS = [
  "אתר הזמנות משלך",
  "משלוחים בזמן אמת",
  "תשלומים אונליין",
  "לקוחות שחוזרים אליך",
];

export default function AdsPageA() {
  return (
    <AdsShell>
      {/* Headline */}
      <div style={{ marginTop: 22, marginBottom: 20, width: "100%" }}>
        <h1 style={{
          fontSize: "clamp(36px,11vw,52px)",
          fontWeight: 900, lineHeight: 1.05,
          color: INK_COLOR, letterSpacing: "-1.5px",
          marginBottom: 10,
        }}>
          עדיין משלם 30%<br />עמלה?
        </h1>
        <p style={{
          fontSize: 16, color: INK_COLOR,
          fontWeight: 600, lineHeight: 1.5,
        }}>
          הגיע הזמן למכור ישירות ללקוחות שלך.
        </p>
      </div>

      {/* White card — checklist + price + CTA */}
      <div style={{
        width: "100%",
        background: "#fff",
        border: "2px solid #000",
        borderRadius: 20,
        boxShadow: "0 4px 0 #000",
        padding: "20px 20px 18px",
        marginTop: "auto",
      }}>
        {/* Checklist */}
        <ul style={{
          listStyle: "none", margin: "0 0 18px", padding: 0,
          display: "flex", flexDirection: "column", gap: 11,
        }}>
          {ITEMS.map((item) => (
            <li key={item} style={{
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 15, fontWeight: 700, color: INK_COLOR,
              textAlign: "right",
            }}>
              <Check />
              {item}
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div style={{ height: 1, background: "#E8E4D5", marginBottom: 16 }} />

        {/* Price — centered */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: INK_COLOR, letterSpacing: "-2px", lineHeight: 1 }}>
            ₪299
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK_COLOR, marginTop: 4 }}>
            לחודש + 0.5% בלבד
          </div>
        </div>

        {/* CTA */}
        <button style={{
          width: "100%", padding: "16px",
          background: INK_COLOR, color: BG_COLOR,
          fontSize: 16, fontWeight: 800,
          border: "2px solid #000", borderRadius: 999,
          cursor: "pointer", letterSpacing: "-0.2px",
          fontFamily: "inherit",
          boxShadow: `0 4px 0 ${BG_COLOR}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <svg style={{ animation: "swipeUp 1.5s ease-in-out infinite", flexShrink: 0 }}
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={BG_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          החליקו למעלה לפרטים נוספים
        </button>

        <p style={{
          textAlign: "center", fontSize: 11,
          color: "rgba(0,0,0,0.45)", marginTop: 10, fontWeight: 500,
        }}>
          7 ימי ניסיון עלינו · ללא כרטיס אשראי · ללא התחייבות
        </p>
      </div>
    </AdsShell>
  );
}
