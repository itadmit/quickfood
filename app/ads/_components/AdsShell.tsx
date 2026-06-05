"use client";

import { ReactNode } from "react";

const BG = "#F8CB1E";
const INK = "#0A0A0A";

export const FEATURES = [
  "אתר הזמנות משלך",
  "משלוחים בזמן אמת",
  "תשלומים אונליין",
  "לקוחות שחוזרים",
  "קופה",
  "מסך מטבח",
  "קופונים ומבצעים",
  "פופאפים",
];

export function FeatureGrid() {
  const half = Math.ceil(FEATURES.length / 2);
  const col1 = FEATURES.slice(0, half);
  const col2 = FEATURES.slice(half);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px 12px", marginBottom: 16 }}>
      {col1.map((f, i) => (
        <FeatureRow key={f} label={f} pair={col2[i]} />
      ))}
    </div>
  );
}

function FeatureRow({ label, pair }: { label: string; pair?: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: INK }}>
        <Check />
        {label}
      </div>
      {pair ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: INK }}>
          <Check />
          {pair}
        </div>
      ) : <div />}
    </>
  );
}

export function SwipeBtn({ color = BG }: { color?: string }) {
  return (
    <button style={{
      width: "100%", padding: "16px",
      background: INK, color,
      fontSize: 16, fontWeight: 800,
      border: "2px solid #000", borderRadius: 999,
      cursor: "pointer", letterSpacing: "-0.2px",
      fontFamily: "inherit",
      boxShadow: `0 4px 0 ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <svg style={{ animation: "swipeUp 1.5s ease-in-out infinite", flexShrink: 0 }}
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
      החליקו למעלה לפרטים נוספים
    </button>
  );
}

export function TrustStrip() {
  return (
    <p style={{
      textAlign: "center", fontSize: 11,
      color: "rgba(0,0,0,0.45)", marginTop: 10, fontWeight: 500,
    }}>
      7 ימי ניסיון עלינו · ללא כרטיס אשראי · ללא התחייבות
    </p>
  );
}

export function AdsShell({ children }: { children: ReactNode }) {
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
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, rgba(0,0,0,0.3) 65%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 0%, black 35%, rgba(0,0,0,0.3) 65%, transparent 100%)",
      }} />

      <div style={{
        position: "relative", zIndex: 3,
        height: "100%",
        display: "flex", flexDirection: "column",
        padding: "48px 20px 36px",
        maxWidth: 480, margin: "0 auto",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quickfood-mark-white.png"
          alt="QuickFood"
          width={48} height={48}
          style={{
            borderRadius: 12, border: "2px solid #000",
            boxShadow: "0 3px 0 #000", display: "block",
          }}
        />
        {children}
      </div>
    </div>
  );
}

export const BG_COLOR = BG;
export const INK_COLOR = INK;
