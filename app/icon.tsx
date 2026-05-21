import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
          color: "#0A0A0A",
          fontFamily: "Pacifico",
          lineHeight: 1,
          position: "relative",
        }}
      >
        <span style={{ fontSize: 44, position: "absolute", top: 6, left: 10 }}>Q</span>
        <span style={{ fontSize: 28, position: "absolute", bottom: 4, right: 12 }}>f</span>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pacifico", data: pacifico, weight: 400, style: "normal" }],
    },
  );
}
