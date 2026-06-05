"use client";

import { AdsShell, FeatureGrid, SwipeBtn, TrustStrip, BG_COLOR, INK_COLOR } from "../_components/AdsShell";

export default function AdsPageB() {
  return (
    <AdsShell>
      <div style={{ marginTop: 20, marginBottom: 16, width: "100%" }}>
        <div style={{
          display: "inline-block", fontSize: 12, fontWeight: 700, color: INK_COLOR,
          background: "rgba(0,0,0,0.09)", border: "1.5px solid rgba(0,0,0,0.15)",
          borderRadius: 100, padding: "4px 12px", marginBottom: 14,
        }}>
          אתר הזמנות למסעדות
        </div>
        <h1 style={{
          fontSize: "clamp(30px,9.5vw,46px)",
          fontWeight: 900, lineHeight: 1.1,
          color: INK_COLOR, letterSpacing: "-1px",
          marginBottom: 12,
        }}>
          כל מסעדה צריכה אתר הזמנות משלה.
        </h1>
        <p style={{ fontSize: 15, color: INK_COLOR, fontWeight: 700, lineHeight: 1.5, marginBottom: 4 }}>
          הלקוחות שלכם כבר מכירים אתכם.
        </p>
        <p style={{ fontSize: 15, color: INK_COLOR, fontWeight: 500, lineHeight: 1.5 }}>
          עכשיו תנו להם להזמין ישירות מהמסעדה.
        </p>
      </div>

      <FeatureGrid />

      <div style={{
        width: "100%", background: "#fff",
        border: "2px solid #000", borderRadius: 20, boxShadow: "0 4px 0 #000",
        padding: "14px 20px", marginBottom: 16, marginTop: "auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: INK_COLOR, letterSpacing: "-2px", lineHeight: 1 }}>₪299</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK_COLOR, marginTop: 4 }}>לחודש + 0.5% בלבד</div>
        </div>
        <div style={{ height: 1, background: "#E8E4D5", marginBottom: 12 }} />
        <SwipeBtn color={BG_COLOR} />
        <TrustStrip />
      </div>
    </AdsShell>
  );
}
