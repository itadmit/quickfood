"use client";

import { useEffect, useState } from "react";

/**
 * Background video for the auth shell's hero panel.
 *
 * Five pexels clips, one picked at random on the client after mount —
 * keeps SSR markup deterministic (no hydration mismatch) and still
 * gives the screen a fresh feel each visit. Muted + autoplay +
 * playsInline so iOS Safari + Chrome let it play without a user tap;
 * loops so the clip never visibly ends.
 *
 * Treatment is deliberately minimal — just a yellow fallback under
 * the video. All the brand-blending (horizontal yellow melt) is
 * applied by the AuthShell aside on top of this component, matching
 * the landing-page `.heroMedia` setup exactly so the two screens
 * read as one brand.
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
      {/* Yellow fallback — visible until the video URL is picked, and
          if the network blocks the pexels stream. */}
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
    </div>
  );
}
