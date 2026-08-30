"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { DURATION, EASE, useMounted, useReducedMotion } from "@/lib/motion";

/*
 * Scroll-triggered reveals — motion brief Animations 1, 2 and 9.
 *
 * Motion brief Rule 3, "static first, then animate": the server-rendered
 * HTML must never contain opacity: 0, or a crawler, a slow connection or
 * a JS-disabled browser sees an empty page. Two things make that work:
 *
 *   1. `initial={false}` — Framer renders the *animate* state on the
 *      first pass instead of a hidden initial state, so the server emits
 *      fully visible markup.
 *   2. The hidden state is only ever entered on the client, after mount,
 *      and it is entered with `duration: 0`. Everything these wrap is
 *      below the fold, so nothing visible is ever hidden on screen; the
 *      reveal back to visible is the animated half.
 *
 * The element type is deliberately identical in every state. An earlier
 * version swapped a plain <div> for a <motion.div> once mounted, which
 * remounted the node and left useInView's IntersectionObserver watching
 * a detached element — so the reveal never fired at all.
 *
 * The hero's own entrance is CSS, not Framer Motion — see .br-enter in
 * app/globals.css and the note in components/home/sections.tsx.
 */

const VIEWPORT = { once: true, amount: 0.15 } as const;

const SHOW = { opacity: 1, y: 0 };
const HIDE = { opacity: 0, y: 20, transition: { duration: 0 } };

/** Animation 1 — fade up. The most-used reveal in the system. */
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, VIEWPORT);
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const hide = mounted && !reduced && !inView;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        hide
          ? HIDE
          : { ...SHOW, transition: { duration: DURATION.base, delay, ease: EASE } }
      }
    >
      {children}
    </motion.div>
  );
}

/** Animation 2 — staggered children, for benefit rows and feature cards. */
export function StaggerGroup({
  children,
  className,
  itemClassName,
}: {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, VIEWPORT);
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const hide = mounted && !reduced && !inView;

  const items = Array.isArray(children) ? children : [children];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={hide ? "hidden" : "visible"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: DURATION.stagger } },
      }}
    >
      {items.map((child, i) => (
        <motion.div
          key={i}
          className={itemClassName}
          variants={{
            hidden: HIDE,
            visible: { ...SHOW, transition: { duration: DURATION.base, ease: EASE } },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Animation 9 — image container reveal. Scales from 1.02 rather than
 * offsetting on y, and runs at the slow duration; the 150ms default delay
 * offsets it from the text block it sits beside.
 */
export function ImageReveal({
  children,
  delay = 0.15,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, VIEWPORT);
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const hide = mounted && !reduced && !inView;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        hide
          ? { opacity: 0, scale: 1.02, transition: { duration: 0 } }
          : {
              opacity: 1,
              scale: 1,
              transition: { duration: DURATION.slow, delay, ease: EASE },
            }
      }
    >
      {children}
    </motion.div>
  );
}
