// The frequency promise shown at the point of opt-in (founder decision:
// four a month). It is a commitment to the subscriber, not a display
// string — if publishing cadence ever exceeds it, this number changes AND
// the consent version bumps, because people opted in to a different deal.
//
// Keep this in sync with NEWSLETTER_VERSION in lib/consent/versions.ts.
export const NEWSLETTER_MAX_PER_MONTH = 4;
