import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const pacifico = readFileSync(join(process.cwd(), "app", "Pacifico-Regular.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F8CB1E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0A0A0A",
          fontFamily: "Pacifico",
          lineHeight: 1,
          position: "relative",
        }}
      >
        <span style={{ fontSize: 124, position: "absolute", top: 16, left: 28 }}>Q</span>
        <span style={{ fontSize: 80, position: "absolute", bottom: 10, right: 36 }}>f</span>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pacifico", data: pacifico, weight: 400, style: "normal" }],
    },
  );
}
