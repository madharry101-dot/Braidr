import { createHash } from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { fail } from "@/lib/api/response";

// TRD 6.4 rate limit groups. Each is a sliding-window limiter backed by
// Upstash Redis (the TRD names "Upstash Redis (or Vercel KV)" — picking
// Upstash since it works identically from Edge Middleware and from Route
// Handlers, whereas Vercel KV is Edge-only).
//
// R-09 — EVERY GROUP MUST DECLARE WHAT HAPPENS WHEN UPSTASH IS UNREACHABLE.
// It used to fail open everywhere, silently: a Redis outage turned every
// limiter off and the only trace was a console line nobody reads. Worse, the
// "allowed" it returned was indistinguishable from a genuine allow, so no
// caller could tell it was unprotected.
//
//   "open"   — allow the request. Correct where the limiter is protecting
//              cost or capacity, and where locking users out is the bigger
//              harm. The control is a nice-to-have; availability wins.
//   "closed" — keep enforcing, using the per-instance fallback below. Correct
//              where the limiter IS the security control and an outage would
//              otherwise be an open invitation to brute force.
//
// `onOutage` is required by the type, so adding a group forces the decision
// rather than letting it default to the permissive option.
type OutagePolicy = "open" | "closed";
type WindowSpec = {
  limit: number;
  window: Parameters<typeof Ratelimit.slidingWindow>[1];
  onOutage: OutagePolicy;
};

const WINDOWS = {
  // Brute force IS the threat here, so an outage must not remove the control.
  auth: { limit: 10, window: "15 m", onOutage: "closed" },
  // Per-EMAIL companion to `auth`, which is per-IP. The IP limiter does not
  // stop mailbox-bombing: a caller with a pool of addresses can point all of
  // them at one victim's inbox and stay under every per-IP bucket. Keyed by a
  // hash of the address (see identifierForEmail) so raw addresses are not
  // sitting in Redis keys. Deliberately low — a real person asking for a
  // reset link does it once or twice, not five times an hour.
  authEmail: { limit: 5, window: "1 h", onOutage: "closed" },
  // Deliberately NOT the `auth` group, even though it is the same surface.
  // Someone holding a valid confirmation token is finishing a registration
  // they already started, and the token is the primary defence here — the
  // limiter only blunts brute-forcing it. Locking a real user out of
  // completing signup because Upstash blipped is the worse outcome, so this
  // one fails open while login/register/reset do not.
  verifyEmail: { limit: 10, window: "15 m", onOutage: "open" },
  // Costs real money per call, but requires an account AND an eligible
  // BraidCare session, which bounds abuse without the limiter.
  braidcareAnalyse: { limit: 5, window: "1 h", onOutage: "open" },
  fileUpload: { limit: 20, window: "1 h", onOutage: "open" },
  styleMatch: { limit: 10, window: "1 h", onOutage: "open" },
  // Creates real Stripe Checkout Sessions; authenticated, so the account is
  // the real gate.
  bookings: { limit: 20, window: "1 h", onOutage: "open" },
  // Already role-gated to admins — this is defence in depth, not the control.
  admin: { limit: 100, window: "1 m", onOutage: "open" },
  // POST /api/csp-report is unauthenticated by necessity — browsers send
  // violation reports with no session. Generous, because a single page load
  // that trips several directives legitimately produces several reports and
  // we would rather not lose the signal we turned this on to collect; but
  // bounded, because it is still a public write endpoint. Fails open: a
  // dropped violation report costs nothing, and failing closed would add a
  // failure mode for no gain.
  cspReport: { limit: 60, window: "1 m", onOutage: "open" },
} as const satisfies Record<string, WindowSpec>;

type RateLimitGroup = keyof typeof WINDOWS;

// How long to wait for Upstash before treating it as unavailable.
//
// Without this, an Upstash that HANGS rather than errors takes the whole route
// with it: the request sits until Netlify kills the function at ~10s and the
// caller gets a platform 502 with no error envelope. A slow limiter should
// degrade to the outage policy, not become an outage of its own.
const LIMIT_TIMEOUT_MS = 1500;

/** Tolerate a value pasted with surrounding quotes or stray whitespace. */
function cleanEnv(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^["']|["']$/g, "");
  return v || undefined;
}

// Constructed lazily and defensively: a missing OR malformed Upstash config
// must degrade to the outage policy, never crash module load (which would
// break `next build`'s page-data collection for every route importing this).
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

// ---------------------------------------------------------------------------
// Per-instance fallback, used only by "closed" groups during an outage.
//
// WHAT IT IS AND IS NOT. This is a fixed-window counter in the memory of one
// serverless instance. Requests spread across N instances get roughly N times
// the intended allowance, and the counters vanish when an instance recycles.
// It is deliberately NOT a replacement for Redis — it is the difference
// between "login is a crude cap while Upstash is down" and either "login is
// completely open" or "login is completely dark". Both of those were the real
// alternatives; this is the middle one.
// ---------------------------------------------------------------------------
const FALLBACK_MAX_KEYS = 5000;
const fallbackCounters = new Map<string, { count: number; resetAt: number }>();

function windowMs(window: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(window.trim());
  if (!match) throw new Error(`unparseable rate-limit window: "${window}"`);
  const value = Number(match[1]);
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
  return value * unit;
}

function fallbackAllows(group: RateLimitGroup, identifier: string): boolean {
  const { limit, window } = WINDOWS[group];
  const now = Date.now();
  const key = `${group}:${identifier}`;

  // Bound memory. An outage plus rotating identifiers must not be a way to
  // exhaust the instance: drop what has expired, and if that is not enough,
  // drop whatever expires soonest.
  if (fallbackCounters.size >= FALLBACK_MAX_KEYS) {
    for (const [k, v] of fallbackCounters) if (v.resetAt <= now) fallbackCounters.delete(k);
    if (fallbackCounters.size >= FALLBACK_MAX_KEYS) {
      let oldestKey: string | null = null;
      let oldestReset = Infinity;
      for (const [k, v] of fallbackCounters) {
        if (v.resetAt < oldestReset) {
          oldestReset = v.resetAt;
          oldestKey = k;
        }
      }
      if (oldestKey) fallbackCounters.delete(oldestKey);
    }
  }

  const entry = fallbackCounters.get(key);
  if (!entry || entry.resetAt <= now) {
    fallbackCounters.set(key, { count: 1, resetAt: now + windowMs(window) });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

const TIMED_OUT = Symbol("rate-limit-timeout");

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([work, expiry]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type RateLimitResult = {
  /** False means the caller is over a cap and must be refused. */
  success: boolean;
  /** True means Upstash could not be consulted, so this verdict is degraded. */
  degraded: boolean;
};

// An outage is a burst, not a single event: every request in flight hits the
// same failure, so logging each one buries the signal in its own noise and
// makes the log expensive exactly when things are going wrong. One line per
// group per minute is enough to see that it started, and that it is ongoing.
//
// Throttled per GROUP rather than globally, so an outage affecting `auth`
// cannot hide one affecting `authEmail`. The suppressed count is reported on
// the next line through, so the volume is never silently lost.
const LOG_THROTTLE_MS = 60_000;
const lastLoggedAt = new Map<RateLimitGroup, { at: number; suppressed: number }>();

function logOutageThrottled(group: RateLimitGroup, message: string): void {
  const now = Date.now();
  const previous = lastLoggedAt.get(group);

  if (previous && now - previous.at < LOG_THROTTLE_MS) {
    previous.suppressed += 1;
    return;
  }

  const suppressed = previous?.suppressed ?? 0;
  lastLoggedAt.set(group, { at: now, suppressed: 0 });
  console.error(
    suppressed > 0
      ? `${message} (${suppressed} similar in the last ${LOG_THROTTLE_MS / 1000}s not logged)`
      : message
  );
}

function handleOutage(group: RateLimitGroup, identifier: string, reason: string): RateLimitResult {
  if (WINDOWS[group].onOutage === "open") {
    logOutageThrottled(
      group,
      `[rate-limit] "${group}" unavailable (${reason}) — policy is fail-open, requests ALLOWED unchecked.`
    );
    return { success: true, degraded: true };
  }

  const allowed = fallbackAllows(group, identifier);
  logOutageThrottled(
    group,
    `[rate-limit] "${group}" unavailable (${reason}) — FAILING CLOSED onto the per-instance counter. This is a degraded security control: the cap is per instance, so the effective allowance is roughly N times the configured limit across N instances.`
  );
  return { success: allowed, degraded: true };
}

/**
 * `identifier` should be the IP for unauthenticated groups (auth) and the
 * user id for authenticated per-user groups (braidcareAnalyse, fileUpload,
 * styleMatch, bookings, admin), per TRD 6.4's "per IP" / "per user" column.
 */
export async function checkRateLimit(
  group: RateLimitGroup,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getLimiter(group);
  if (!limiter) return handleOutage(group, identifier, "Upstash is not configured");

  try {
    const result = await withTimeout(limiter.limit(identifier), LIMIT_TIMEOUT_MS);
    if (result === TIMED_OUT) {
      return handleOutage(group, identifier, `no response within ${LIMIT_TIMEOUT_MS}ms`);
    }
    return { success: result.success, degraded: false };
  } catch (e) {
    return handleOutage(group, identifier, e instanceof Error ? e.message : String(e));
  }
}

/**
 * The single place a refusal becomes a response. Returns null when the caller
 * may proceed, so routes read as `if (r) return r;`.
 *
 * A refusal is always 429, degraded or not: whether the cap came from Redis or
 * from the fallback, the caller genuinely is over a cap. There is no 503 here
 * on purpose — with the fallback in place a "closed" group never hard-denies
 * everyone, so there is no state that means "we cannot answer you".
 */
export function rateLimitResponse(result: RateLimitResult) {
  if (result.success) return null;
  return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
}

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

/**
 * Rate-limit identifier for an email address.
 *
 * Hashed rather than raw: rate-limit keys live in Upstash with a different
 * retention and access story from the database, and an address is personal
 * data whether or not it belongs to a registered user. The hash only has to
 * be stable and collision-resistant, not reversible.
 */
export function identifierForEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex").slice(0, 32);
}
