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

// Tolerate a value that was pasted with surrounding quotes or stray
// whitespace (a common env-var mistake) rather than letting `new Redis()`
// throw over it.
function cleanEnv(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^["']|["']$/g, "");
  return v || undefined;
}

// Constructed lazily and defensively: a missing OR malformed Upstash
// config must degrade to "fail open + warn", never crash module load
// (which would break `next build`'s page-data collection for every route
// that imports this file).
let redisResolved = false;
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redisResolved) return redis;
  redisResolved = true;

  const url = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return null;

  try {
    redis = new Redis({ url, token });
  } catch (e) {
    console.error("[rate-limit] Upstash config is invalid — rate limiting disabled.", e);
    redis = null;
  }
  return redis;
}

const limiters = new Map<RateLimitGroup, Ratelimit>();

function getLimiter(group: RateLimitGroup): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  if (!limiters.has(group)) {
    const { limit, window } = WINDOWS[group];
    limiters.set(
      group,
      new Ratelimit({
        redis: client,
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
 * If Upstash isn't configured (or is misconfigured), this fails open and
 * logs a warning rather than blocking every request — it must be working
 * before production launch (PRD 8.1 launch gate: rate limiting is P1).
 */
/**
 * Best-effort client IP for the "per IP" limiter groups. Netlify's Next.js
 * runtime does NOT populate `x-forwarded-for` on the Request handed to a
 * Route Handler the way Node/Vercel does — it exposes the connecting IP as
 * `x-nf-client-connection-ip` instead. Falling straight to a constant
 * ("unknown") means every unauthenticated caller shares ONE bucket, so one
 * client (or a load test) locks out everyone. Try the real headers first;
 * only share a bucket as an absolute last resort.
 */
export function clientIp(request: { headers: Headers }): string {
  const h = request.headers;
  const nf = h.get("x-nf-client-connection-ip");
  if (nf) return nf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function checkRateLimit(group: RateLimitGroup, identifier: string) {
  const limiter = getLimiter(group);
  if (!limiter) {
    console.warn(`[rate-limit] Upstash not active — "${group}" is unenforced.`);
    return { success: true as const };
  }
  try {
    const result = await limiter.limit(identifier);
    return { success: result.success };
  } catch (e) {
    // A Redis outage must not take auth/uploads down with it.
    console.error(`[rate-limit] "${group}" check failed — allowing request.`, e);
    return { success: true as const };
  }
}
