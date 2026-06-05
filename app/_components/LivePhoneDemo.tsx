"use client";

import { useState } from "react";
import styles from "./LivePhoneDemo.module.css";

interface Props {
  src: string;
  title: string;
}

/**
 * Phone bezel + iframe + iOS-style loader. Loader hides on iframe load.
 * The iframe is loaded lazily so it doesn't block the landing page LCP.
 */
export default function LivePhoneDemo({ src, title }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={styles.screen} aria-busy={!loaded}>
      <div className={styles.notch} />
      <iframe
        src={src}
        title={title}
        loading="lazy"
        className={styles.frame}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className={styles.loader} aria-hidden>
          <IosSpinner />
        </div>
      )}
    </div>
  );
}

/**
 * iOS-style spinner - 12 rounded dashes rotating around a center, each one
 * fading on a 12-step phase loop. Pure SVG + CSS so it works without JS.
 */
function IosSpinner() {
  return (
    <svg viewBox="0 0 32 32" className={styles.spinner} aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x={15}
          y={4}
          width={2}
          height={6}
          rx={1}
          fill="currentColor"
          transform={`rotate(${i * 30} 16 16)`}
          style={{ animationDelay: `${(i * 100) - 1100}ms` }}
        />
      ))}
    </svg>
  );
}
