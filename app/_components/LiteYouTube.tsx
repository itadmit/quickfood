"use client";

import { useState } from "react";
import styles from "./LiteYouTube.module.css";

// Lite facade for a YouTube embed: at rest it's only the video thumbnail
// with a brand play button - zero YouTube chrome and zero YouTube JS.
// The real iframe (youtube-nocookie, autoplay) loads on first click.
export function LiteYouTube({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${videoId}/oardefault.jpg`);

  if (playing) {
    return (
      <iframe
        className={styles.iframe}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      className={styles.facade}
      onClick={() => setPlaying(true)}
      aria-label={`נגן וידאו: ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumb, no remotePatterns entry */}
      <img
        className={styles.thumb}
        src={thumb}
        alt=""
        loading="lazy"
        onError={() => setThumb(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)}
      />
      <span className={styles.scrim} aria-hidden />
      <span className={styles.play} aria-hidden>
        <span className={styles.playTriangle} />
      </span>
    </button>
  );
}
