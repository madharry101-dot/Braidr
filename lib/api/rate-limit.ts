import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// TRD 6.4 rate limit groups. Each is a sliding-window limiter backed by
// Upstash Redis (the TRD names "Upstash Redis (or Vercel KV)" — picking
// Upstash since it works identically from Edge Middleware and from Route
// Handlers, whereas Vercel KV is Edge-only).
const WINDOWS = {
  auth: { limit: 10, window: "15 m" },
  braidcareAnalyse: { limit: 5, window: "1 h" },
  fileUpload: { limit: 20, window: "1 h" },
  styleMatch: { limit: 10, window: "1 h" },
  generalApi: { limit: 200, window: "1 m" },
  admin: { limit: 100, window: "1 m" },
} as const;

type RateLimitGroup = keyof typeof WINDOWS;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<RateLimitGroup, Ratelimit>();

function getLimiter(group: RateLimitGroup): Ratelimit | null {
  if (!redis) return null;
  if (!limiters.has(group)) {
    const { limit, window } = WINDOWS[group];
    limiters.set(
      group,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        prefix: `braidr:ratelimit:${group}`,
      })
    );
  }
  return limiters.get(group)!;
}

/**
 * `identifier` should be the IP for unauthenticated groups (auth) and the
 * user id for authenticated per-user groups (braidcareAnalyse, fileUpload,
 * styleMatch, admin), per TRD 6.4's "per IP" / "per user" column.
 *
 * If Upstash isn't configured (e.g. local dev without it set up yet), this
 * fails open and logs a warning rather than blocking every request — it
 * must be configured before production launch (PRD 8.1 launch gate implies
 * this: rate limiting is a P1 security requirement).
 */
export async function checkRateLimit(group: RateLimitGroup, identifier: string) {
  const limiter = getLimiter(group);
  if (!limiter) {
    console.warn(`[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — "${group}" is unenforced.`);
    return { success: true as const };
  }
  const result = await limiter.limit(identifier);
  return { success: result.success };
}
