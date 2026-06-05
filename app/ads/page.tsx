"use client";

const BG_COLOR = "#F8CB1E";
const INK = "#0A0A0A";

export default function AdsPage() {
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
        @keyframes swipeUp {
          0%,100% { transform: translateY(0); opacity: 0.7; }
          50%      { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>

      {/* Video background — same URL as the homepage */}
      <video
        src="https://videos.pexels.com/video-files/33880845/14378437_360_640_24fps.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", zIndex: 0,
        }}
      />

      {/* Yellow tint overlay — preserves brand color over the video */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "rgba(248,203,30,0.62)",
      }} />

      {/* Dot pattern — exact copy from landing page */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 2,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.09) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, rgba(0,0,0,0.4) 75%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 0%, black 40%, rgba(0,0,0,0.4) 75%, transparent 100%)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 3,
        height: "100%",
        display: "flex", flexDirection: "column",
        padding: "52px 24px 44px",
        maxWidth: 480, margin: "0 auto",
      }}>

        {/* Logo — same style as homepage */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/quickfood-mark-white.png"
            alt="QuickFood"
            width={48}
            height={48}
            style={{
              borderRadius: 12,
              border: "2px solid #000",
              boxShadow: "0 3px 0 #000",
              display: "block",
            }}
          />
        </div>

        {/* Main copy */}
        <div style={{ marginBottom: 24 }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.08)",
            border: "1.5px solid rgba(0,0,0,0.15)",
            borderRadius: 100,
            padding: "5px 14px",
            fontSize: 12, color: INK, fontWeight: 600,
            marginBottom: 22,
          }}>
            <span style={{
              display: "inline-block", width: 7, height: 7,
              borderRadius: "50%", background: "#16a34a", flexShrink: 0,
            }} />
            7 ימי ניסיון · ללא כרטיס אשראי
          </div>

          <h1 style={{
            fontSize: "clamp(38px,11vw,52px)",
            fontWeight: 900,
            lineHeight: 1,
            color: INK,
            letterSpacing: "-1.5px",
            marginBottom: 14,
          }}>
            <span style={{ display: "block", marginBottom: 10 }}>הלקוחות שלך.</span>
            <span style={{ display: "block", marginBottom: 10 }}>ההזמנות שלך.</span>
            <span style={{
              display: "inline-block",
              background: INK, color: BG_COLOR,
              borderRadius: 10, padding: "2px 14px",
            }}>
              האתר שלך.
            </span>
          </h1>

          <p style={{
            fontSize: 15, color: "rgba(0,0,0,0.68)",
            lineHeight: 1.55, fontWeight: 400, marginTop: 14,
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
            boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
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
