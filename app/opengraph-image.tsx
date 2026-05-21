import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const alt = "QuickFood — חנות אונליין למסעדה שלך";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const pacifico = readFileSync(join(process.cwd(), "app", "Pacifico-Regular.ttf"));
  const rubikBold = readFileSync(join(process.cwd(), "app", "Rubik-Bold.ttf"));
  const rubikBlack = readFileSync(join(process.cwd(), "app", "Rubik-Black.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F8CB1E",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          color: "#0A0A0A",
          fontFamily: "Rubik",
          position: "relative",
        }}
      >
        {/* Subtle decorative diagonal stripes */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 24px, transparent 24px 64px)",
          }}
        />

        {/* Brand wordmark */}
        <div
          style={{
            fontFamily: "Pacifico",
            fontSize: 132,
            lineHeight: 1,
            marginBottom: 24,
            display: "flex",
          }}
        >
          QuickFood
        </div>

        {/* Hebrew headline */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            direction: "rtl",
          }}
        >
          <div>חנות אונליין למסעדה שלך.</div>
          <div>בלי לחלוק עם החברות הגדולות.</div>
        </div>

        {/* Bottom row: price chip + URL */}
        <div
          style={{
            position: "absolute",
            bottom: 64,
            left: 96,
            right: 96,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#0A0A0A",
              color: "#F8CB1E",
              padding: "14px 24px",
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 800,
              display: "flex",
            }}
          >
            ₪299 לחודש · 0.5% להזמנה
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              opacity: 0.7,
              display: "flex",
            }}
          >
            quickfood.co.il
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pacifico", data: pacifico, weight: 400, style: "normal" },
        { name: "Rubik", data: rubikBold, weight: 700, style: "normal" },
        { name: "Rubik", data: rubikBlack, weight: 900, style: "normal" },
      ],
    },
  );
}
