"use client";

import { useEffect, useRef, useState } from "react";

const BG_COLOR = "#F8CB1E";
const INK = "#0A0A0A";

export default function AdsPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onError = () => setVideoFailed(true);
    el.addEventListener("error", onError);
    el.play().catch(() => setVideoFailed(true));
    return () => el.removeEventListener("error", onError);
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: BG_COLOR,
        fontFamily:
          "var(--font-noto-hebrew,'Noto Sans Hebrew','Heebo',Arial,sans-serif)",
      }}
    >
      <style>{`
        @keyframes blobA {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(40px,-30px) scale(1.08); }
        }
        @keyframes blobB {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-35px,25px) scale(1.06); }
        }
        @keyframes blobC {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(20px,40px) scale(1.05); }
        }
        @keyframes swipeUp {
          0%,100% { transform: translateY(0); opacity: 0.7; }
          50%      { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>

      {/* Animated warm blobs behind the dot pattern */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <div style={{
          position: "absolute", width: 520, height: 520,
          borderRadius: "50%", background: "#F0BE32",
          top: -100, right: -80,
          animation: "blobA 7s ease-in-out infinite",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", width: 400, height: 400,
          borderRadius: "50%", background: "#FFE099",
          bottom: -60, left: -60,
          animation: "blobB 9s ease-in-out infinite",
          filter: "blur(50px)",
        }} />
        <div style={{
          position: "absolute", width: 300, height: 300,
          borderRadius: "50%", background: "#FBD84A",
          top: "40%", left: "30%",
          animation: "blobC 11s ease-in-out infinite",
          filter: "blur(70px)",
        }} />
      </div>

      {/* Dot pattern — exact copy from landing page */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.09) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, rgba(0,0,0,0.4) 75%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 0%, black 40%, rgba(0,0,0,0.4) 75%, transparent 100%)",
      }} />

      {/* Optional video overlay (plays if file exists at /ads/bg.mp4) */}
      {!videoFailed && (
        <video
          ref={videoRef}
          autoPlay muted loop playsInline
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", zIndex: 2,
            opacity: 0.22,
            mixBlendMode: "multiply",
          }}
        >
          <source src="/ads/bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 3,
        height: "100%",
        display: "flex", flexDirection: "column",
        padding: "52px 24px 44px",
        maxWidth: 480, margin: "0 auto",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "auto" }}>
          <div style={{
            width: 44, height: 44,
            background: INK, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 3px 0 ${BG_COLOR}`,
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 32 32" width={30} height={30} xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#fff" fillOpacity="0.12" />
              <text x="16" y="23" textAnchor="middle"
                fontFamily="'Pacifico','Brush Script MT',cursive"
                fontSize="20" fill="#F8CB1E">F</text>
            </svg>
          </div>
          <span style={{
            fontSize: 20, fontWeight: 800, color: INK, letterSpacing: "-0.3px",
          }}>
            QuickFood
          </span>
        </div>

        {/* Main copy */}
        <div style={{ marginBottom: 24 }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.08)",
            border: "1.5px solid rgba(0,0,0,0.12)",
            borderRadius: 100,
            padding: "5px 14px",
            fontSize: 12, color: INK, fontWeight: 600,
            marginBottom: 18,
          }}>
            <span style={{
              display: "inline-block", width: 7, height: 7,
              borderRadius: "50%", background: "#22c55e", flexShrink: 0,
            }} />
            7 ימי ניסיון · ללא כרטיס אשראי
          </div>

          <h1 style={{
            fontSize: "clamp(38px,11vw,52px)",
            fontWeight: 900,
            lineHeight: 1.05,
            color: INK,
            letterSpacing: "-1.5px",
            marginBottom: 14,
          }}>
            הלקוחות שלך.<br />
            ההזמנות שלך.<br />
            <span style={{
              background: INK, color: BG_COLOR,
              borderRadius: 10, padding: "2px 12px",
              display: "inline-block",
            }}>
              העתיד שלך.
            </span>
          </h1>

          <p style={{
            fontSize: 15, color: "rgba(0,0,0,0.68)",
            lineHeight: 1.55, fontWeight: 400,
          }}>
            פלטפורמת הזמנות ישירה לעסק שלך — הלקוחות מזמינים ישירות אצלך.
          </p>
        </div>

        {/* Price badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(0,0,0,0.07)",
          border: "1.5px solid rgba(0,0,0,0.12)",
          borderRadius: 16, padding: "14px 18px",
          marginBottom: 18,
        }}>
          <div>
            <div style={{
              fontSize: 40, fontWeight: 900, color: INK,
              lineHeight: 1, letterSpacing: "-1.5px",
            }}>
              ₪299
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", fontWeight: 500 }}>
              לחודש בלבד
            </span>
            <span style={{ fontSize: 15, color: INK, fontWeight: 700 }}>
              + 0.5% לעסקה
            </span>
          </div>
          <div style={{
            width: 1, height: 38,
            background: "rgba(0,0,0,0.12)",
            margin: "0 4px", flexShrink: 0,
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 12, color: INK, fontWeight: 700 }}>
              ללא התחייבות
            </span>
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 500 }}>
              מחיר קבוע לכל החיים
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          style={{
            width: "100%", padding: "17px",
            background: INK, color: BG_COLOR,
            fontSize: 17, fontWeight: 800,
            border: "none", borderRadius: 999,
            cursor: "pointer", letterSpacing: "-0.2px",
            fontFamily: "inherit",
            boxShadow: `0 4px 0 rgba(0,0,0,0.25)`,
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}
        >
          <svg
            style={{ animation: "swipeUp 1.5s ease-in-out infinite", flexShrink: 0 }}
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={BG_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
          החליקו למעלה לפרטים נוספים
        </button>

        {/* Trust strip */}
        <p style={{
          textAlign: "center", fontSize: 11,
          color: "rgba(0,0,0,0.50)", marginTop: 12,
          fontWeight: 500,
        }}>
          7 ימי ניסיון עלינו · ללא כרטיס אשראי · ללא התחייבות
        </p>
      </div>
    </div>
  );
}
