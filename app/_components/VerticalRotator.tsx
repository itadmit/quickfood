"use client";

import { useEffect, useState } from "react";

interface Props {
  words: string[];
  /** ms each word stays visible (excluding the slide animations) */
  hold?: number;
  /** ms for slide-in / slide-out animation */
  slide?: number;
  className?: string;
  wordClassName?: string;
}

/**
 * Cycles through `words` with a vertical slide animation — current word
 * slides down and fades out, next word slides in from above. Loops.
 */
export default function VerticalRotator({
  words,
  hold = 1800,
  slide = 420,
  className,
  wordClassName,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    if (words.length <= 1) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "in") {
      t = setTimeout(() => setPhase("hold"), slide);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("out"), hold);
    } else {
      t = setTimeout(() => {
        setIdx((i) => (i + 1) % words.length);
        setPhase("in");
      }, slide);
    }
    return () => clearTimeout(t);
  }, [phase, hold, slide, words.length]);

  // Inline styles so the component is self-contained — no CSS module needed.
  const wordStyle: React.CSSProperties = {
    display: "inline-block",
    transition: `transform ${slide}ms cubic-bezier(.65,0,.35,1), opacity ${slide}ms ease`,
    transform:
      phase === "in"
        ? "translateY(0)"
        : phase === "out"
          ? "translateY(40%)"
          : "translateY(0)",
    opacity: phase === "out" ? 0 : phase === "in" ? 1 : 1,
  };

  // Slide-in starts from -40% above and 0 opacity. We achieve that by
  // briefly forcing the "starting" position when the phase enters "in".
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    if (phase !== "in") return;
    setEntering(true);
    const t = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(t);
  }, [phase, idx]);

  const finalStyle: React.CSSProperties =
    phase === "in" && entering
      ? { ...wordStyle, transform: "translateY(-40%)", opacity: 0, transition: "none" }
      : wordStyle;

  return (
    <span className={className} aria-live="polite" style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
      <span className={wordClassName} style={finalStyle} key={idx}>
        {words[idx]}
      </span>
    </span>
  );
}
