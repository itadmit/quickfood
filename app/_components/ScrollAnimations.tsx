"use client";

import { useEffect } from "react";

/**
 * Watches the landing page's card surfaces with IntersectionObserver
 * and stamps `data-in-view="true"` on each one the first time it
 * crosses the viewport threshold. CSS in page.module.css transitions
 * `opacity` + `translateY` based on that attribute.
 *
 * The selectors here are CSS-module hashed at build time (the class
 * tokens we use are `${styles.bffRow}` etc.), but the underlying
 * generated class names always start with the source name - so we
 * match on `[class*="howStep"]` etc. instead of literal class names.
 * That keeps the observer in sync without importing the styles map.
 *
 * Honours `prefers-reduced-motion` by skipping the observer entirely
 * - the matching CSS rule already forces cards to their resting state.
 */
export default function ScrollAnimations() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const selectors = [
      '[class*="bffRow"]',
      '[class*="qfoodCard"]',
      '[class*="miniCell"]',
      '[class*="priceCard"]',
    ];
    const targets = document.querySelectorAll<HTMLElement>(selectors.join(","));
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-in-view", "true");
            io.unobserve(entry.target);
          }
        }
      },
      {
        // Triggers when 15% of the card is past the bottom edge - late
        // enough to feel like a reveal, early enough that the user
        // doesn't have to scroll past to see it animate.
        threshold: 0.15,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    // Cards already above the fold on first paint should reveal
    // immediately (no waiting for scroll); the observer fires for them
    // on its initial pass anyway, but stamping them up-front avoids a
    // perceptible "everything is hidden" flicker before that callback.
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.85) {
        el.setAttribute("data-in-view", "true");
      } else {
        io.observe(el);
      }
    });

    return () => io.disconnect();
  }, []);

  return null;
}
