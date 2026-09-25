import { rejectUnauthorisedCron } from "@/lib/cron/auth";

// R-07. The bug this pins was not that the check was missing — it was that
// the check PASSED for an attacker when CRON_SECRET was unset, because
// `Bearer ${undefined}` stringifies to the literal "Bearer undefined" on
// both sides of the comparison. Nothing about a working deployment looked
// any different from a wide-open one, so only a test can hold the line.

const SECRET = "a-real-cron-secret-value";

function req(authorization?: string): Request {
  return new Request("https://braidr.netlify.app/api/cron/daily", {
    headers: authorization ? { authorization } : {},
  });
}

describe("cron bearer gate (R-07)", () => {
  const original = process.env.CRON_SECRET;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  describe("when CRON_SECRET is not set", () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET;
    });

    // THE regression. Before the fix this returned null — i.e. authorised —
    // and the caller went on to delete accounts and release payouts.
    it('rejects the literal "Bearer undefined" bypass', async () => {
      const res = rejectUnauthorisedCron(req("Bearer undefined"));
      expect(res).not.toBeNull();
      expect(res!.status).toBe(500);
    });

    it("rejects a correct-looking token too — it fails closed, not open", () => {
      expect(rejectUnauthorisedCron(req(`Bearer ${SECRET}`))).not.toBeNull();
    });

    it("says so on the server log rather than failing silently", () => {
      rejectUnauthorisedCron(req("Bearer undefined"));
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET is not set"));
    });

    it("does not name the missing variable to the caller", async () => {
      const body = await rejectUnauthorisedCron(req())!.json();
      expect(JSON.stringify(body)).not.toContain("CRON_SECRET");
    });
  });

  describe("when CRON_SECRET is set", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = SECRET;
    });

    it("authorises the correct bearer token", () => {
      expect(rejectUnauthorisedCron(req(`Bearer ${SECRET}`))).toBeNull();
    });

    it("rejects a wrong token with 401, not 500", () => {
      const res = rejectUnauthorisedCron(req("Bearer wrong"));
      expect(res!.status).toBe(401);
    });

    // The 500-vs-401 split is the whole point: it is the only way to tell a
    // misconfigured deployment from a rejected stranger, from the outside.
    it('rejects "Bearer undefined" with 401 when properly configured', () => {
      expect(rejectUnauthorisedCron(req("Bearer undefined"))!.status).toBe(401);
    });

    it("rejects a missing Authorization header", () => {
      expect(rejectUnauthorisedCron(req())!.status).toBe(401);
    });

    it("rejects the bare secret without the Bearer prefix", () => {
      expect(rejectUnauthorisedCron(req(SECRET))!.status).toBe(401);
    });

    it("rejects a token that is a correct prefix of the secret", () => {
      expect(rejectUnauthorisedCron(req(`Bearer ${SECRET.slice(0, -1)}`))!.status).toBe(401);
    });

    it("rejects a token longer than the secret (timingSafeEqual must not throw)", () => {
      expect(rejectUnauthorisedCron(req(`Bearer ${SECRET}xxxxxxxxxx`))!.status).toBe(401);
    });
  });

  it("treats an empty-string CRON_SECRET as unset", () => {
    process.env.CRON_SECRET = "";
    expect(rejectUnauthorisedCron(req("Bearer "))!.status).toBe(500);
  });
});

// The block above tests the gate. This one tests that every route actually
// USES it — grep proves the text is present, not that it is reached. These
// call the real exported GET handlers; both branches return before any
// Supabase, Stripe or Resend call, so the dummy credentials below are never
// exercised (they exist only to get the modules past import-time construction).
describe("every /api/cron/* route is wired to the gate", () => {
  const ROUTES = [
    "account-deletion",
    "daily",
    "expire-stale-bookings",
    "hmrc-deadline-reminders",
    "newsletter",
    "purge-braidcare-photos",
    "release-payouts",
    "retry-braidcare-analysis",
  ];

  const DUMMY_ENV = {
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: "whsec_dummy",
    NEXT_PUBLIC_SUPABASE_URL: "https://dummy.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy",
    SUPABASE_SERVICE_ROLE_KEY: "dummy",
    RESEND_API_KEY: "re_dummy",
    ANTHROPIC_API_KEY: "sk-ant-dummy",
  };

  const original = process.env.CRON_SECRET;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    Object.assign(process.env, DUMMY_ENV);
  });
  afterEach(() => {
    consoleError.mockRestore();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it.each(ROUTES)("%s refuses to run when CRON_SECRET is unset", async (route) => {
    const { GET } = await import(`@/app/api/cron/${route}/route`);
    delete process.env.CRON_SECRET;
    const res = await GET(
      new Request("https://braidr.netlify.app/api/cron", {
        headers: { authorization: "Bearer undefined" },
      })
    );
    expect(res.status).toBe(500);
  });

  it.each(ROUTES)("%s rejects a wrong token with 401 when configured", async (route) => {
    const { GET } = await import(`@/app/api/cron/${route}/route`);
    process.env.CRON_SECRET = "a-real-cron-secret-value";
    const res = await GET(
      new Request("https://braidr.netlify.app/api/cron", {
        headers: { authorization: "Bearer not-the-secret" },
      })
    );
    expect(res.status).toBe(401);
  });
});
