"use client";

import { AdsShell, FeatureGrid, SwipeBtn, TrustStrip, BG_COLOR, INK_COLOR } from "./_components/AdsShell";

export default function AdsPageA() {
  return (
    <AdsShell>
      <div style={{ marginTop: 20, marginBottom: 16, width: "100%" }}>
        <h1 style={{
          fontSize: "clamp(34px,10.5vw,50px)",
          fontWeight: 900, lineHeight: 1.05,
          color: INK_COLOR, letterSpacing: "-1.5px",
          marginBottom: 10,
        }}>
          עדיין משלם 30%<br />עמלה?
        </h1>
        <p style={{ fontSize: 15, color: INK_COLOR, fontWeight: 600, lineHeight: 1.55 }}>
          הגיע הזמן למכור ישירות ללקוחות שלך. פלטפורמה מלאה לניהול עסק מזון — הזמנות, שליחים, תשלומים ועוד.
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
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: INK_COLOR, letterSpacing: "-2px", lineHeight: 1 }}>
            ₪299
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK_COLOR, marginTop: 4 }}>
            לחודש + 0.5% בלבד
          </div>
        </div>
        <div style={{ height: 1, background: "#E8E4D5", marginBottom: 16 }} />
        <SwipeBtn color={BG_COLOR} />
        <TrustStrip />
      </div>
    </AdsShell>
  );
}
