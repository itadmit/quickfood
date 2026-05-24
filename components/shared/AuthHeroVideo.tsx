"use client";

import { useEffect, useState } from "react";

/**
 * Background video for the auth shell's hero panel.
 *
 * Five pexels clips, one is picked at random on the client after
 * mount — keeps SSR markup deterministic (no hydration mismatch) and
 * still gives the screen a fresh feel each visit. Muted + autoplay +
 * playsInline so iOS Safari + Chrome let it play without a user tap;
 * loops so the clip never visibly ends.
 *
 * Above the video we lay a yellow tint + a linear gradient so the
 * brand panel still reads as "yellow with a hint of footage" rather
 * than "stock food video", matching the landing-page hero treatment.
 */
const VIDEOS = [
  "https://videos.pexels.com/video-files/28308907/12357079_360_640_30fps.mp4",
  "https://videos.pexels.com/video-files/8803784/8803784-sd_360_640_24fps.mp4",
  "https://videos.pexels.com/video-files/7930814/7930814-sd_360_640_24fps.mp4",
  "https://videos.pexels.com/video-files/20416737/20416737-sd_360_640_24fps.mp4",
  "https://videos.pexels.com/video-files/32592722/13898697_360_640_30fps.mp4",
];

export function AuthHeroVideo() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(VIDEOS[Math.floor(Math.random() * VIDEOS.length)]);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      {/* Yellow base — visible until the video URL is picked, and as
          the fallback if the network blocks the pexels stream. */}
      <div className="absolute inset-0" style={{ backgroundColor: "#F8CB1E" }} />

      {src && (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden
        />
      )}

      {/* Yellow tint via multiply — gives the footage a uniform
          duotone yellow without flattening it to a solid color, so you
          still feel the motion underneath. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#F8CB1E",
          mixBlendMode: "multiply",
          opacity: 0.72,
        }}
      />

      {/* Soft top-to-bottom gradient — keeps the headline area
          readable while leaving the bottom features tile alone. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(248,203,30,0.55) 0%, rgba(248,203,30,0.15) 45%, rgba(248,203,30,0.85) 100%)",
        }}
      />

      {/* Same faint dot grid as the landing-page hero — ties the
          panel to the surrounding cream backdrop. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.22) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );
}
