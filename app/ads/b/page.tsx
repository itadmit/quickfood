"use client";

import { AdsShell, FeatureGrid, SwipeBtn, TrustStrip, BG_COLOR, INK_COLOR } from "../_components/AdsShell";

export default function AdsPageB() {
  return (
    <AdsShell>
      <div style={{ marginTop: 20, marginBottom: 16, width: "100%" }}>
        <h1 style={{
          fontSize: "clamp(34px,10.5vw,50px)",
          fontWeight: 900, lineHeight: 1.05,
          color: INK_COLOR, letterSpacing: "-1.5px",
          marginBottom: 12,
        }}>
          בעלי מסעדות?
        </h1>
        <p style={{ fontSize: 16, color: INK_COLOR, fontWeight: 700, lineHeight: 1.55 }}>
          הפסיקו לשלם עד 30% עמלה על כל הזמנה.
        </p>
        <p style={{ fontSize: 15, color: INK_COLOR, fontWeight: 500, lineHeight: 1.55, marginTop: 6 }}>
          קבלו אתר הזמנות משלכם — עם משלוחים, תשלומים ומעקב בזמן אמת.
        </p>
      </div>

      <FeatureGrid />

      <div style={{
        width: "100%",
        background: "#fff",
        border: "2px solid #000",
        borderRadius: 20,
        boxShadow: "0 4px 0 #000",
        padding: "14px 20px 14px",
        marginBottom: 16,
        marginTop: "auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: INK_COLOR, letterSpacing: "-2px", lineHeight: 1 }}>
            ₪299
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK_COLOR, marginTop: 4 }}>
            לחודש + 0.5% בלבד
          </div>
        </div>
        <div style={{ height: 1, background: "#E8E4D5", marginBottom: 12 }} />
        <SwipeBtn color={BG_COLOR} />
        <TrustStrip />
      </div>
    </AdsShell>
  );
}
