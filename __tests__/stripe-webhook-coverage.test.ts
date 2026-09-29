import { readFileSync } from "fs";
import { join } from "path";

// R-06 follow-up — the anti-silent-drop guard.
//
// WHY THIS EXISTS. While building R-06 I rewrote the dispatch switch and
// silently dropped `invoice.payment_failed`. Subscription payment-failure
// emails would simply have stopped. Nothing failed: the route still
// compiled, still returned 200, and the event fell through `default:` and
// was recorded as successfully processed. Only an ESLint unused-symbol
// warning caught it, and only because I happened to check an exit code.
//
// THE LIST BELOW IS THE SPECIFICATION. Every type here must reach a real
// handler. Removing a `case` from the route without also removing it here
// fails this suite. Removing both is then a deliberate, reviewable decision
// rather than an accident — which is the whole point.
//
// Each entry carries a payload and an observable: proving a case is merely
// PRESENT in the source is not enough, because `case "x": break;` is present
// and does nothing. Each probe asserts the handler was actually entered.

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
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockCreateAdminClient() }));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));

/** Any chain of query-builder calls resolves to `{ data: null, error: null }`. */
function queryChain(): unknown {
  const settled = Promise.resolve({ data: null, error: null });
  const proxy: unknown = new Proxy(settled, {
    get(target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const fn = (target as unknown as Record<string, unknown>)[prop as string];
        return (fn as (...a: unknown[]) => unknown).bind(target);
      }
      return () => proxy;
    },
  });
  return proxy;
}

type Probe = {
  /** What the route must have touched, proving the handler was entered. */
  observed: (ctx: { from: jest.Mock }) => boolean;
  object: Record<string, unknown>;
  why: string;
};

const touchedTable =
  (table: string) =>
  ({ from }: { from: jest.Mock }) =>
    from.mock.calls.some((c) => c[0] === table);

const EXPECTED: Record<string, Probe> = {
  "checkout.session.completed": {
    object: { id: "cs_1", metadata: { booking_id: "b1" } },
    observed: touchedTable("bookings"),
    why: "confirms the booking, writes the income record, emails both parties",
  },
  "checkout.session.expired": {
    object: { id: "cs_2", metadata: { booking_id: "b1", type: "booking" } },
    observed: touchedTable("bookings"),
    why: "releases the held slot when checkout is abandoned",
  },
  "payment_intent.payment_failed": {
    object: { id: "pi_1", metadata: { booking_id: "b1" } },
    observed: touchedTable("bookings"),
    why: "marks the booking payment_failed and tells the client",
  },
  "transfer.created": {
    object: { id: "tr_1", metadata: { booking_id: "b1" } },
    observed: touchedTable("bookings"),
    why: "records the payout transfer id against the booking",
  },
  "account.updated": {
    object: { id: "acct_1" },
    observed: () => mockAccountsRetrieve.mock.calls.length > 0,
    why: "keeps stripe_charges_enabled in step with Connect onboarding",
  },
  "customer.subscription.created": {
    object: { id: "sub_1" },
    observed: () => mockSubscriptionsRetrieve.mock.calls.length > 0,
    why: "grants BraidCare / Pro access",
  },
  "customer.subscription.updated": {
    object: { id: "sub_1" },
    observed: () => mockSubscriptionsRetrieve.mock.calls.length > 0,
    why: "tracks past_due and the dunning grace period",
  },
  "customer.subscription.deleted": {
    object: { id: "sub_1" },
    observed: () => mockSubscriptionsRetrieve.mock.calls.length > 0,
    why: "revokes access when a subscription ends",
  },
  "invoice.payment_failed": {
    object: { id: "in_1", customer: "cus_1" },
    observed: touchedTable("profiles"),
    why: "THE ONE I DROPPED — warns the subscriber their payment failed",
  },
};

describe("every Stripe event Braidr must handle reaches a handler", () => {
  let POST: (r: Request) => Promise<Response>;
  let from: jest.Mock;
  let spies: jest.SpyInstance[];

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    spies = [
      jest.spyOn(console, "error").mockImplementation(() => {}),
      jest.spyOn(console, "warn").mockImplementation(() => {}),
      jest.spyOn(console, "info").mockImplementation(() => {}),
    ];

    mockAccountsRetrieve.mockResolvedValue({ id: "acct_1", charges_enabled: false });
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: "sub_1",
      status: "active",
      metadata: {},
      items: { data: [] },
    });

    from = jest.fn(() => queryChain());
    mockCreateAdminClient.mockReturnValue({
      from,
      rpc: jest.fn((name: string) =>
        Promise.resolve({
          data: name === "claim_stripe_webhook_event" ? "claimed" : null,
          error: null,
        })
      ),
      auth: { admin: { getUserById: jest.fn(() => Promise.resolve({ data: { user: null } })) } },
    });

    ({ POST } = await import("@/app/api/stripe/webhook/route"));
  });

  afterEach(() => spies.forEach((s) => s.mockRestore()));

  function post(type: string, object: Record<string, unknown>) {
    mockConstructEvent.mockReturnValue({ id: `evt_${type}`, type, data: { object } });
    return POST(
      new Request("https://braidr.netlify.app/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=fake" },
        body: "{}",
      })
    );
  }

  it.each(Object.entries(EXPECTED))("%s is dispatched to a handler", async (type, probe) => {
    const res = await post(type, probe.object);
    expect(res.status).toBe(200);
    // If this fails, the `case` for this type is missing from dispatch() — or
    // is present but does nothing. Either way the event is being silently
    // acknowledged and never acted on. See `why`: %s
    expect(probe.observed({ from })).toBe(true);
  });

  it("an event type we do not handle falls through without touching anything", async () => {
    const res = await post("radar.early_fraud_warning.created", { id: "issfr_1" });
    expect(res.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
  });

  // Behavioural coverage above proves each listed type is handled. This also
  // catches the reverse: a case added to the route that nobody declared here,
  // so the spec and the switch cannot drift apart in either direction.
  it("the route dispatches exactly the event types listed here, no more", () => {
    const source = readFileSync(join(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8");
    const dispatchStart = source.indexOf("async function dispatch(");
    expect(dispatchStart).toBeGreaterThan(-1);
    const dispatchBody = source.slice(dispatchStart, source.indexOf("\n}", dispatchStart));

    const cases = [...dispatchBody.matchAll(/case "([a-z._]+)"/g)].map((m) => m[1]).sort();
    expect(cases).toEqual(Object.keys(EXPECTED).sort());
  });
});
