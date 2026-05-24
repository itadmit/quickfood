"use client";

import { useEffect, useState } from "react";

const VIDEOS = [
  "https://videos.pexels.com/video-files/28308907/12357079_360_640_30fps.mp4",
  "https://videos.pexels.com/video-files/8803784/8803784-sd_360_640_24fps.mp4",
  "https://videos.pexels.com/video-files/7930814/7930814-sd_360_640_24fps.mp4",
  "https://videos.pexels.com/video-files/20416737/20416737-sd_360_640_24fps.mp4",
  "https://videos.pexels.com/video-files/32592722/13898697_360_640_30fps.mp4",
];

export function AuthHeroVideo() {
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    const shuffled = [...VIDEOS].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
  }, []);

  const src = queue[0] ?? null;

  function handleError() {
    setQueue((q) => q.slice(1));
  }

  return (
    <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
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
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden
        />
      )}
    </div>
  );
}
