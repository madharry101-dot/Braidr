// R-06 — the ROUTE's half of replay protection: given each possible claim
// outcome, does the webhook do the right thing?
//
// The ledger's own guarantees (atomic claim, lease expiry, two simultaneous
// claims resolving to one winner) are Postgres guarantees, proved against the
// real database by scripts/verify-webhook-dedup.mjs — including the naive
// insert-first comparison that shows both failure modes for real. Mocking
// them here would only test the mock. What IS worth pinning here is the
// route's ordering and branching, because both are easy to break by accident.

const mockConstructEvent = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockAccountsRetrieve = jest.fn();
const mockCreateAdminClient = jest.fn();

jest.mock("@/lib/stripe/client", () => ({
  stripe: {
    webhooks: { constructEvent: (...a: unknown[]) => mockConstructEvent(...a) },
    subscriptions: { retrieve: (...a: unknown[]) => mockSubscriptionsRetrieve(...a) },
    accounts: { retrieve: (...a: unknown[]) => mockAccountsRetrieve(...a) },
  },
}));
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));

function request() {
  return new Request("https://braidr.netlify.app/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=fake" },
    body: "{}",
  });
}

const RPC = {
  claim: "claim_stripe_webhook_event",
  complete: "complete_stripe_webhook_event",
  release: "release_stripe_webhook_event",
};

/** Records the order of ledger calls, so "processed" can be proved to come last. */
function makeAdmin(claimResult: string | null, claimError: unknown = null) {
  const calls: string[] = [];
  const rpc = jest.fn((name: string) => {
    calls.push(name);
    if (name === RPC.claim) return Promise.resolve({ data: claimResult, error: claimError });
    if (name.startsWith("apply_stripe_")) return Promise.resolve({ data: "applied", error: null });
    return Promise.resolve({ data: null, error: null });
  });
  const from = jest.fn(() => ({
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }));
  return { admin: { rpc, from }, calls };
}

describe("stripe webhook dedup ledger (R-06)", () => {
  let POST: (r: Request) => Promise<Response>;
  let consoleError: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;
  let consoleInfo: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
    ({ POST } = await import("@/app/api/stripe/webhook/route"));
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    consoleInfo.mockRestore();
  });

  function event(type: string, object: Record<string, unknown> = {}) {
    mockConstructEvent.mockReturnValue({
      id: "evt_test_123",
      type,
      // Real Stripe events carry `created` (Unix seconds); R-13 needs it.
      created: 1_800_000_000,
      data: { object },
    });
  }

  it("processes a freshly claimed event and marks it processed AFTER the handler", async () => {
    const { admin, calls } = makeAdmin("claimed");
    mockCreateAdminClient.mockReturnValue(admin);
    event("some.unhandled.type");

    expect((await POST(request())).status).toBe(200);
    expect(calls).toEqual([RPC.claim, RPC.complete]);
  });

  it("treats a reclaimed event (expired lease) as work still to do", async () => {
    const { admin, calls } = makeAdmin("reclaimed");
    mockCreateAdminClient.mockReturnValue(admin);
    event("some.unhandled.type");

    expect((await POST(request())).status).toBe(200);
    expect(calls).toEqual([RPC.claim, RPC.complete]);
  });

  it("acknowledges a genuine duplicate without running the handler again", async () => {
    const { admin, calls } = makeAdmin("already_processed");
    mockCreateAdminClient.mockReturnValue(admin);
    event("account.updated", { id: "acct_1" });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { duplicate: true } });
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
    expect(calls).toEqual([RPC.claim]);
  });

  // THE CONCURRENT-DUPLICATE CASE. A 200 here would tell Stripe the event is
  // handled while another delivery may still fail — nobody would retry it.
  it("asks Stripe to retry when another delivery holds the lease", async () => {
    const { admin, calls } = makeAdmin("in_flight");
    mockCreateAdminClient.mockReturnValue(admin);
    event("account.updated", { id: "acct_1" });

    const res = await POST(request());

    expect(res.status).toBe(409);
    expect(res.ok).toBe(false); // explicitly not a 2xx
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
    expect(calls).toEqual([RPC.claim]);
  });

  // THE HANDLER-THROWS-THEN-RETRY CASE.
  it("releases the lease and returns 5xx when the handler throws", async () => {
    const { admin, calls } = makeAdmin("claimed");
    mockCreateAdminClient.mockReturnValue(admin);
    event("account.updated", { id: "acct_1" });
    mockAccountsRetrieve.mockRejectedValue(
      Object.assign(new Error("Stripe unreachable"), { statusCode: 500 })
    );

    const res = await POST(request());

    expect(res.status).toBe(500);
    expect(calls).toEqual([RPC.claim, RPC.release]);
    // The assertion that matters: it must NOT be recorded as done.
    expect(calls).not.toContain(RPC.complete);
  });

  it("never marks an event processed when it was never dispatched", async () => {
    const { admin, calls } = makeAdmin(null, { message: "db down" });
    mockCreateAdminClient.mockReturnValue(admin);
    event("some.unhandled.type");

    expect((await POST(request())).status).toBe(500);
    expect(calls).toEqual([RPC.claim]);
  });

  describe("fetching current state instead of trusting the payload", () => {
    it("applies what Stripe says now, not what the event carried", async () => {
      const { admin } = makeAdmin("claimed");
      mockCreateAdminClient.mockReturnValue(admin);
      // Event says charges are enabled; Stripe currently says they are not.
      event("account.updated", { id: "acct_1", charges_enabled: true });
      mockAccountsRetrieve.mockResolvedValue({ id: "acct_1", charges_enabled: false });

      expect((await POST(request())).status).toBe(200);
      expect(mockAccountsRetrieve).toHaveBeenCalledWith("acct_1");
      // R-13 routes the write through apply_stripe_account_state, so assert on
      // the VALUE handed to it rather than merely that a table was touched.
      expect(admin.rpc).toHaveBeenCalledWith(
        "apply_stripe_account_state",
        expect.objectContaining({ p_account_id: "acct_1", p_charges_enabled: false })
      );
    });

    it("treats a 404 as terminal, logs at error level, and applies nothing", async () => {
      const { admin, calls } = makeAdmin("claimed");
      mockCreateAdminClient.mockReturnValue(admin);
      event("account.updated", { id: "acct_gone" });
      mockAccountsRetrieve.mockRejectedValue(
        Object.assign(new Error("No such account"), { statusCode: 404 })
      );

      const res = await POST(request());

      expect(res.status).toBe(200); // acknowledged: a retry cannot fix a 404
      expect(calls).toEqual([RPC.claim, RPC.complete]);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("404"));
      expect(admin.from).not.toHaveBeenCalled();
      expect(admin.rpc).not.toHaveBeenCalledWith("apply_stripe_account_state", expect.anything());
    });
  });

  it("still rejects a bad signature before touching the ledger", async () => {
    const { admin, calls } = makeAdmin("claimed");
    mockCreateAdminClient.mockReturnValue(admin);
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    expect((await POST(request())).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
