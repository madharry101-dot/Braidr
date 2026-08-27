// Minimal class combiner — join truthy values with a space. No dependency on
// clsx/tailwind-merge; components are written so classes don't need merging.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
