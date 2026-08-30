"use client";

import { useEffect, useState } from "react";

/**
 * True once the page has scrolled past `offset`. Drives the floating nav's
 * dark-to-cream transition (motion brief, Animation 5).
 *
 * Deliberately a scroll listener rather than a Framer Motion value: the
 * properties it toggles are background/shadow/blur, which are paint-only
 * and belong in a CSS transition.
 */
export function useScrolled(offset = 60) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);

  return scrolled;
}
