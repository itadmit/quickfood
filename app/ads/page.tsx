"use client";

import { useEffect, useRef } from "react";

const VIDEOS = [
  "https://videos.pexels.com/video-files/3209828/3209828-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/4253935/4253935-uhd_2560_1440_25fps.mp4",
  "https://videos.pexels.com/video-files/3843965/3843965-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/7456498/7456498-hd_1280_720_25fps.mp4",
  "https://videos.pexels.com/video-files/6966966/6966966-hd_1920_1080_25fps.mp4",
];

export default function AdsPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#0a0a0a",
        fontFamily:
          "var(--font-noto-hebrew, -apple-system, 'Segoe UI', Arial, sans-serif)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.10) 30%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.85) 100%)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "52px 24px 44px",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "auto" }}>
          <div
            style={{
              width: 42,
              height: 42,
              background: "#fff",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 32 32" width={30} height={30} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="qfg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#qfg)" />
              <text
                x="16"
                y="22.5"
                textAnchor="middle"
                fontFamily="'Pacifico','Brush Script MT',cursive"
                fontSize="22"
                fill="#ffffff"
              >
                F
              </text>
            </svg>
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.3px",
            }}
          >
            QuickFood
          </span>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 100,
              padding: "5px 14px",
              fontSize: 13,
              color: "#fff",
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            אין עמלות. אין ביניים. רק העסק שלך.
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 10vw, 48px)",
              fontWeight: 900,
              lineHeight: 1.1,
              color: "#fff",
              letterSpacing: "-1px",
              marginBottom: 14,
            }}
          >
            הלקוחות שלך,
            <br />
            הכסף שלך.
            <br />
            <span
              style={{
                background: "#FFD023",
                color: "#000",
                borderRadius: 10,
                padding: "2px 12px",
                display: "inline-block",
              }}
            >
              סוף לוולט.
            </span>
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.80)",
              lineHeight: 1.55,
              fontWeight: 400,
            }}
          >
            הזמנות ישירות לעסק שלך — בלי 30% לאפליקציות הגדולות.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(255,255,255,0.11)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 16,
            padding: "14px 18px",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color: "#FFD023",
                lineHeight: 1,
                letterSpacing: "-1px",
              }}
            >
              ₪299
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", fontWeight: 400 }}>
              לחודש בלבד
            </span>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 600 }}>
              + 0.5% לעסקה
            </span>
          </div>
          <div
            style={{
              width: 1,
              height: 38,
              background: "rgba(255,255,255,0.18)",
              margin: "0 4px",
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
                textDecoration: "line-through",
                fontWeight: 500,
              }}
            >
              וולט: 30%
            </span>
            <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>
              חוסכים אלפי ₪
            </span>
          </div>
        </div>

        <button
          style={{
            width: "100%",
            padding: "17px",
            background: "#fff",
            color: "#000",
            fontSize: 17,
            fontWeight: 800,
            border: "none",
            borderRadius: 14,
            cursor: "pointer",
            letterSpacing: "-0.2px",
            fontFamily: "inherit",
          }}
        >
          QuickFood — פתחו לי חנות
        </button>
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "rgba(255,255,255,0.40)",
            marginTop: 10,
          }}
        >
          ניסיון חינם · ללא כרטיס אשראי
        </p>
      </div>
    </div>
  );
}
