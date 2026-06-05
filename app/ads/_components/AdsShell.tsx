"use client";

import { ReactNode } from "react";

const BG = "#F8CB1E";
const INK = "#0A0A0A";

export function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill={INK} />
      <polyline points="4.5 9 7.5 12 13.5 6" stroke={BG} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

      {/* Video */}
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

      {/* Yellow tint — stronger for readability */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "rgba(248,203,30,0.72)",
      }} />

      {/* Dot pattern */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 2,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.09) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, rgba(0,0,0,0.3) 65%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 0%, black 35%, rgba(0,0,0,0.3) 65%, transparent 100%)",
      }} />

      {/* Page content */}
      <div style={{
        position: "relative", zIndex: 3,
        height: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "48px 20px 36px",
        maxWidth: 480, margin: "0 auto",
        textAlign: "center",
      }}>

        {/* Logo */}
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
