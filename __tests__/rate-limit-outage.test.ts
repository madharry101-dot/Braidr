// R-09 — what the limiter does when Upstash cannot be reached.
//
// This used to fail open everywhere, silently, and the "allowed" it returned
// was indistinguishable from a real allow. So a Redis outage quietly switched
// off brute-force protection on login and nothing said so.
//
// Every test here is about the degraded path, because the healthy path was
// never the problem.

const mockLimit = jest.fn();
const mockSlidingWindow = jest.fn((..._args: unknown[]) => "sliding-window");

jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    jest.fn(() => ({ limit: mockLimit })),
    { slidingWindow: (...a: unknown[]) => mockSlidingWindow(...a) }
  ),
}));
jest.mock("@upstash/redis", () => ({ Redis: jest.fn(() => ({ isMock: true })) }));

type RateLimitModule = typeof import("@/lib/api/rate-limit");

/** Fresh module per test: the fallback counters and the cached Redis client are module state. */
async function load(): Promise<RateLimitModule> {
  return import("@/lib/api/rate-limit");
}

describe("rate limiting during an Upstash outage (R-09)", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockLimit.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  describe("healthy Upstash", () => {
    it("reports a verdict that is not degraded", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const { checkRateLimit } = await load();
      expect(await checkRateLimit("auth", "1.2.3.4")).toEqual({ success: true, degraded: false });
    });

    it("refuses when Upstash says the caller is over the limit", async () => {
      mockLimit.mockResolvedValue({ success: false });
      const { checkRateLimit } = await load();
      expect(await checkRateLimit("auth", "1.2.3.4")).toEqual({ success: false, degraded: false });
    });
  });

  // THE CORE OF R-09. A naive fail-open limiter passes every other test in
  // this file and fails this one, because it lets an unlimited number of
  // login attempts through the moment Redis is unreachable.
  describe("a fail-CLOSED group keeps enforcing", () => {
    it("caps login attempts using the per-instance fallback", async () => {
      mockLimit.mockRejectedValue(new Error("ECONNREFUSED"));
      const { checkRateLimit } = await load();

      const verdicts = [];
      for (let i = 0; i < 12; i++) verdicts.push(await checkRateLimit("auth", "9.9.9.9"));

      // `auth` is 10 per 15 minutes.
      expect(verdicts.slice(0, 10).every((v) => v.success)).toBe(true);
      expect(verdicts[10].success).toBe(false);
      expect(verdicts[11].success).toBe(false);
      // Every one of them is flagged degraded, so a caller can tell the
      // verdict came from the fallback and not from Redis.
      expect(verdicts.every((v) => v.degraded)).toBe(true);
    });

    it("applies the same policy when Upstash is simply not configured", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const { checkRateLimit } = await load();

      const verdicts = [];
      for (let i = 0; i < 12; i++) verdicts.push(await checkRateLimit("auth", "8.8.8.8"));

      expect(verdicts[10].success).toBe(false);
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("counts each identifier separately, so one attacker cannot lock everyone out", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      for (let i = 0; i < 11; i++) await checkRateLimit("auth", "attacker");
      expect((await checkRateLimit("auth", "attacker")).success).toBe(false);
      expect((await checkRateLimit("auth", "someone-else")).success).toBe(true);
    });

    it("lets the window expire, rather than blocking an identifier forever", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      const start = Date.now();
      const clock = jest.spyOn(Date, "now").mockReturnValue(start);
      for (let i = 0; i < 11; i++) await checkRateLimit("auth", "7.7.7.7");
      expect((await checkRateLimit("auth", "7.7.7.7")).success).toBe(false);

      clock.mockReturnValue(start + 15 * 60_000 + 1); // just past the 15m window
      expect((await checkRateLimit("auth", "7.7.7.7")).success).toBe(true);
      clock.mockRestore();
    });

    it("stays bounded when an outage is combined with rotating identifiers", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      // More distinct keys than the fallback will hold.
      for (let i = 0; i < 6000; i++) await checkRateLimit("auth", `rotating-${i}`);

      // Still functioning, and still enforcing for a single identifier.
      for (let i = 0; i < 11; i++) await checkRateLimit("auth", "steady");
      expect((await checkRateLimit("auth", "steady")).success).toBe(false);
    });
  });

  describe("a fail-OPEN group lets traffic through", () => {
    it.each([
      "fileUpload",
      "braidcareAnalyse",
      "styleMatch",
      "bookings",
      "admin",
      "cspReport",
    ] as const)("%s allows unchecked during an outage", async (group) => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();
      for (let i = 0; i < 50; i++) {
        expect(await checkRateLimit(group, "user-1")).toEqual({ success: true, degraded: true });
      }
    });

    // Explicitly pinned because it is the one that contradicts its neighbours:
    // it shares a surface with login but must NOT be locked down on an outage.
    it("verify-email fails open even though login does not", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      for (let i = 0; i < 30; i++) {
        expect((await checkRateLimit("verifyEmail", "1.1.1.1")).success).toBe(true);
      }
      // Same outage, same identifier, different policy.
      for (let i = 0; i < 11; i++) await checkRateLimit("auth", "1.1.1.1");
      expect((await checkRateLimit("auth", "1.1.1.1")).success).toBe(false);
    });
  });

  // A limiter that HANGS is worse than one that errors: without a timeout the
  // request sits until Netlify kills the function at ~10s and the caller gets
  // a platform 502 with no error envelope.
  describe("a hanging Upstash", () => {
    it("gives up after the timeout and applies the outage policy", async () => {
      jest.useFakeTimers();
      mockLimit.mockImplementation(() => new Promise(() => {})); // never settles
      const { checkRateLimit } = await load();

      const pending = checkRateLimit("auth", "5.5.5.5");
      await jest.advanceTimersByTimeAsync(1500);

      await expect(pending).resolves.toEqual({ success: true, degraded: true });
    });

    it("does not hang forever", async () => {
      jest.useFakeTimers();
      mockLimit.mockImplementation(() => new Promise(() => {}));
      const { checkRateLimit } = await load();

      let settled = false;
      const pending = checkRateLimit("auth", "6.6.6.6").then((r) => {
        settled = true;
        return r;
      });

      await jest.advanceTimersByTimeAsync(1499);
      expect(settled).toBe(false); // still waiting, as intended
      await jest.advanceTimersByTimeAsync(2);
      await pending;
      expect(settled).toBe(true);
    });
  });

  describe("rateLimitResponse", () => {
    it("returns null when the caller may proceed", async () => {
      const { rateLimitResponse } = await load();
      expect(rateLimitResponse({ success: true, degraded: false })).toBeNull();
      expect(rateLimitResponse({ success: true, degraded: true })).toBeNull();
    });

    it("refuses with 429 whether the verdict came from Redis or the fallback", async () => {
      const { rateLimitResponse } = await load();
      for (const degraded of [false, true]) {
        const res = rateLimitResponse({ success: false, degraded })!;
        expect(res.status).toBe(429);
        expect((await res.json()).error.code).toBe("RATE_LIMITED");
      }
    });
  });

  // An outage is a burst: every in-flight request hits the same failure. One
  // line per request buries the signal in its own noise and makes logging
  // expensive exactly when things are going wrong.
  describe("outage logging is throttled", () => {
    it("logs once for a burst, not once per request", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      for (let i = 0; i < 50; i++) await checkRateLimit("auth", `ip-${i}`);

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("FAILING CLOSED"));
    });

    it("logs again after the throttle window, and reports what it suppressed", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      const start = Date.now();
      const clock = jest.spyOn(Date, "now").mockReturnValue(start);
      for (let i = 0; i < 10; i++) await checkRateLimit("auth", `ip-${i}`);
      expect(consoleError).toHaveBeenCalledTimes(1);

      clock.mockReturnValue(start + 60_001);
      await checkRateLimit("auth", "later");

      expect(consoleError).toHaveBeenCalledTimes(2);
      // The volume is never silently lost.
      expect(consoleError).toHaveBeenLastCalledWith(expect.stringContaining("9 similar"));
      clock.mockRestore();
    });

    it("throttles per group, so one outage cannot hide another", async () => {
      mockLimit.mockRejectedValue(new Error("down"));
      const { checkRateLimit } = await load();

      await checkRateLimit("auth", "x");
      await checkRateLimit("authEmail", "y");
      await checkRateLimit("fileUpload", "z");

      expect(consoleError).toHaveBeenCalledTimes(3);
    });
  });

  it("says loudly that it is degraded, on every outage path", async () => {
    mockLimit.mockRejectedValue(new Error("ECONNREFUSED"));
    const { checkRateLimit } = await load();
    await checkRateLimit("auth", "1.2.3.4");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("unavailable"));
  });
});

// This file declares top-level helpers and has no top-level import, which
// would otherwise make it a global script and collide with the identically
// named helper in a sibling test file. `export {}` makes it a module.
export {};
