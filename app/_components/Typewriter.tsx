"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

interface Props {
  words: string[];
  /** ms — how long each word is shown fully typed before deleting */
  hold?: number;
  /** ms per character during type-in / delete-out */
  charDelay?: number;
}

/**
 * Rotating typewriter for the hero em accent. Cycles through `words`,
 * typing each one out, holding, deleting, and moving to the next. The
 * span inherits its color + background from `.headline em` so the
 * yellow-pill highlight applies to whichever word is currently shown.
 */
export default function Typewriter({ words, hold = 1600, charDelay = 70 }: Props) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(words[0] ?? "");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[idx] ?? "";

    if (!deleting && shown === current) {
      const t = window.setTimeout(() => setDeleting(true), hold);
      return () => window.clearTimeout(t);
    }
    if (deleting && shown === "") {
      const t = window.setTimeout(() => {
        setDeleting(false);
        setIdx((i) => (i + 1) % words.length);
      }, 240);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      setShown((s) =>
        deleting ? s.slice(0, -1) : current.slice(0, s.length + 1),
      );
    }, deleting ? charDelay / 1.8 : charDelay);
    return () => window.clearTimeout(t);
  }, [shown, deleting, idx, words, hold, charDelay]);

  return (
    <em className={styles.typewriter} aria-live="polite">
      <span>{shown || " "}</span>
      <span className={styles.typewriterCursor} aria-hidden>
        |
      </span>
    </em>
  );
}
