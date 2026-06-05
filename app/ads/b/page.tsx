"use client";

import { AdsShell, FeatureGrid, SwipeBtn, TrustStrip, BG_COLOR, INK_COLOR } from "../_components/AdsShell";

export default function AdsPageB() {
  return (
    <AdsShell>
      <div style={{ marginTop: 20, marginBottom: 16, width: "100%" }}>
        <h1 style={{
          fontSize: "clamp(32px,10vw,48px)",
          fontWeight: 900, lineHeight: 1.08,
          color: INK_COLOR, letterSpacing: "-1.5px",
          marginBottom: 10,
        }}>
          כמה שילמת לוולט<br />החודש?
        </h1>
        <p style={{ fontSize: 15, color: INK_COLOR, fontWeight: 600, lineHeight: 1.55 }}>
          עכשיו תדמיין שכל הלקוחות החוזרים שלך מזמינים ישירות מהאתר שלך — ללא עמלות ענק, עם כלים מקצועיים לצמיחה.
        </p>
      </div>

      <FeatureGrid />

      <div style={{
        width: "100%",
        background: "#fff",
        border: "2px solid #000",
        borderRadius: 20,
        boxShadow: "0 4px 0 #000",
        padding: "20px 20px 18px",
        marginTop: "auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: INK_COLOR, letterSpacing: "-2px", lineHeight: 1 }}>
            ₪299
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK_COLOR, marginTop: 4 }}>
            לחודש + 0.5% בלבד
          </div>
        </div>
        <p style={{
          fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.50)",
          textAlign: "center", marginBottom: 14,
        }}>
          הלקוחות שלך. ההזמנות שלך. האתר שלך.
        </p>
        <SwipeBtn color={BG_COLOR} />
        <TrustStrip />
      </div>
    </AdsShell>
  );
}
