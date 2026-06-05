"use client";

import { FeatureGrid } from "../_components/AdsShell";

const BG = "#F8CB1E";
const INK = "#0A0A0A";

export default function AdsPageC() {
  return (
    <div
      dir="rtl"
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        background: BG,
        fontFamily: "var(--font-noto-hebrew,'Noto Sans Hebrew','Heebo',Arial,sans-serif)",
      }}
    >
      <style>{`
        @keyframes swipeUp {
          0%,100% { transform: translateY(0); opacity: 0.7; }
          50%      { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>

      <video
        src="https://videos.pexels.com/video-files/33880845/14378437_360_640_24fps.mp4"
        autoPlay muted loop playsInline preload="metadata"
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", zIndex: 0,
        }}
      />
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "rgba(248,203,30,0.72)",
      }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 2,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.09) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, rgba(0,0,0,0.3) 70%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 0%, black 40%, rgba(0,0,0,0.3) 70%, transparent 100%)",
      }} />

      <div style={{
        position: "relative", zIndex: 3,
        height: "100%",
        display: "flex", flexDirection: "column",
        padding: "52px 24px 44px",
        maxWidth: 480, margin: "0 auto",
      }}>

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quickfood-mark-white.png"
          alt="QuickFood"
          width={48} height={48}
          style={{ borderRadius: 12, border: "2px solid #000", boxShadow: "0 3px 0 #000", display: "block" }}
        />

        {/* Hero headline */}
        <div style={{ marginTop: "auto", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.08)",
            border: "1.5px solid rgba(0,0,0,0.15)",
            borderRadius: 100, padding: "5px 14px",
            fontSize: 12, color: INK, fontWeight: 600,
            marginBottom: 20,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", display: "inline-block", flexShrink: 0 }} />
            7 ימי ניסיון · ללא כרטיס אשראי
          </div>

          <h1 style={{
            fontSize: "clamp(42px,13vw,62px)",
            fontWeight: 900, lineHeight: 1,
            color: INK, letterSpacing: "-2px",
          }}>
            <span style={{ display: "block", marginBottom: 8 }}>הלקוחות שלך.</span>
            <span style={{ display: "block", marginBottom: 8 }}>ההזמנות שלך.</span>
            <span style={{
              display: "inline-block",
              background: INK, color: BG,
              borderRadius: 12, padding: "2px 14px",
            }}>
              האתר שלך.
            </span>
          </h1>

          <p style={{ fontSize: 16, color: INK, fontWeight: 600, lineHeight: 1.5, marginTop: 16, marginBottom: 18 }}>
            פלטפורמת הזמנות ישירה לעסק שלך. הלקוחות הקבועים שלך מזמינים אצלך — בלי לשלם עמלות לאף אחד.
          </p>
          <FeatureGrid />
        </div>

        {/* Price strip + CTA */}
        <div style={{
          background: "#fff",
          border: "2px solid #000",
          borderRadius: 20,
          boxShadow: "0 4px 0 #000",
          padding: "18px 20px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 900, color: INK, letterSpacing: "-2px", lineHeight: 1 }}>₪299</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>לחודש + 0.5% בלבד</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>ללא התחייבות</div>
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.50)", fontWeight: 500 }}>מחיר קבוע לכל החיים</div>
            </div>
          </div>

          <button style={{
            width: "100%", padding: "16px",
            background: INK, color: BG,
            fontSize: 16, fontWeight: 800,
            border: "2px solid #000", borderRadius: 999,
            cursor: "pointer", letterSpacing: "-0.2px",
            fontFamily: "inherit",
            boxShadow: `0 4px 0 ${BG}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg style={{ animation: "swipeUp 1.5s ease-in-out infinite", flexShrink: 0 }}
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={BG} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            החליקו למעלה לפרטים נוספים
          </button>
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 10, fontWeight: 500 }}>
            7 ימי ניסיון עלינו · ללא כרטיס אשראי · ללא התחייבות
          </p>
        </div>
      </div>
    </div>
  );
}
