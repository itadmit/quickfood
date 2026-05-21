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
          fontSize: 52,
          lineHeight: 1,
          paddingBottom: 6,
        }}
      >
        Q
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pacifico", data: pacifico, weight: 400, style: "normal" }],
    },
  );
}
