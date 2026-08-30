"use client";

import { useEffect, useState } from "react";

/*
 * Motion tokens. Approved in the Phase 1 motion pass and reviewed live —
 * these are the same durations, easing and stagger that were signed off.
 *
 * Nothing in the product should invent its own timing. If a new animation
 * needs a duration that isn't here, that's a design question, not an
 * implementation one.
 */

export const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export const DURATION = {
  fast: 0.15,
  base: 0.5,
  slow: 0.7,
  stagger: 0.08,
} as const;

/**
 * The user's prefers-reduced-motion setting, live.
 *
 * Every motion component short-circuits to a plain element when this is
 * true. The global `@media (prefers-reduced-motion: reduce)` block in
 * app/globals.css is the second layer of defence, covering the CSS-driven
 * animations (nav transition, hover states, hero entrance, skeletons).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * False during server render and the first client render, true afterwards.
 *
 * Motion brief, Rule 3 — "static first, then animate". Framer Motion's
 * `initial` prop would otherwise put `opacity: 0` into the server-rendered
 * HTML, so a slow connection, a crawler, or a JS-disabled browser would
 * see nothing. Gating on this means the server always emits fully visible
 * content and the animation is layered on afterwards.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
