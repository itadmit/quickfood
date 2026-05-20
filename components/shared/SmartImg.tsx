"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  src: string;
  alt: string;
  className?: string;
  /** style.width/height when not fill */
  width?: number;
  height?: number;
  /** Cover the parent (parent must define a size). */
  fill?: boolean;
  /** Native loading hint. Defaults to "lazy". */
  loading?: "lazy" | "eager";
  /** Pass-through priority for hero images. */
  fetchPriority?: "high" | "low" | "auto";
}

/**
 * `<img>` with a gentle skeleton-shimmer while the network request is in
 * flight, then a 300ms opacity fade-in once the image loads. Uses the
 * existing `animate-qf-pulse` keyframes so it respects reduced-motion.
 *
 * Use this wherever a raw <img> would otherwise pop in abruptly — menu
 * cards, tenant cover images, item details. Designed to drop in without
 * size-impact: the wrapper takes the same dimensions the <img> would have,
 * so layout doesn't shift between "loading" and "loaded".
 */
export function SmartImg({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  loading = "lazy",
  fetchPriority = "auto",
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <span
      className={cn(
        "relative overflow-hidden bg-qf-line-soft inline-block",
        fill && "w-full h-full",
        className,
      )}
      style={!fill && width && height ? { width, height } : undefined}
    >
      {!loaded && !errored && (
        <span
          className="absolute inset-0 animate-qf-pulse bg-qf-line-soft"
          aria-hidden
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
