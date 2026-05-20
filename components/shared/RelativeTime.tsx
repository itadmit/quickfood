"use client";

import { useEffect, useState } from "react";
import { formatRelativeMinutes } from "@/lib/format";

interface Props {
  date: string | Date;
  /** Optional placeholder rendered until after hydration. Default: empty string. */
  fallback?: string;
}

/**
 * Renders a human-friendly "לפני X דק'" label without causing React hydration
 * mismatches (error #418).
 *
 * The naïve approach — calling `formatRelativeMinutes` directly in render —
 * computes `Date.now() - date` at server-render time and again at the client's
 * first paint. Even small clock drift produces different text on each side,
 * which React 19 surfaces as a hydration error.
 *
 * Instead we render the `fallback` (empty by default) on SSR + first paint,
 * then swap to the live label after the first effect tick.
 */
export function RelativeTime({ date, fallback = "" }: Props) {
  const [label, setLabel] = useState<string>(fallback);

  useEffect(() => {
    setLabel(formatRelativeMinutes(date));
    const id = setInterval(() => setLabel(formatRelativeMinutes(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  return <>{label}</>;
}
