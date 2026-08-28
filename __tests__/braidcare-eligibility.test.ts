import { checkBraidcareEligibility } from "@/lib/braidcare/eligibility";

// Minimal fake of the query-builder chains eligibility.ts uses:
//   from("braidcare_subscriptions").select().eq().eq().maybeSingle()
//   from("bookings").select().eq().eq().single()
function fakeSupabase(opts: { subscription?: { status: string } | null; booking?: unknown }) {
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "in", "is"]) c[m] = () => c;
    c.maybeSingle = async () => ({ data: result ?? null });
    c.single = async () => ({ data: result ?? null });
    return c;
  };
  return {
    from: (table: string) =>
      chain(table === "braidcare_subscriptions" ? (opts.subscription ?? null) : opts.booking),
  } as never;
}

const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe("BraidCare eligibility (plan §1.1a two-path model)", () => {
  it("an active subscriber is eligible with no booking", async () => {
    const r = await checkBraidcareEligibility(
      fakeSupabase({ subscription: { status: "active" } }),
      "u1",
      null
    );
    expect(r).toEqual({ ok: true, reason: "subscription", booking: null });
  });

  it("a subscriber's session-start ignores an exhausted booking cap", async () => {
    const r = await checkBraidcareEligibility(
      fakeSupabase({
        subscription: { status: "active" },
        booking: {
          id: "b1",
          status: "confirmed",
          braidcare_live_at: past,
          sessions_allocated: 3,
          sessions_used: 3,
        },
      }),
      "u1",
      "b1"
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reason).toBe("subscription");
  });

  it("no subscription and no booking -> NO_BOOKING_OR_SUBSCRIPTION", async () => {
    const r = await checkBraidcareEligibility(fakeSupabase({ subscription: null }), "u1", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NO_BOOKING_OR_SUBSCRIPTION");
  });

  it("free tier: window not open -> WINDOW_NOT_OPEN", async () => {
    const r = await checkBraidcareEligibility(
      fakeSupabase({
        booking: {
          id: "b1",
          status: "confirmed",
          braidcare_live_at: soon,
          sessions_allocated: 3,
          sessions_used: 0,
        },
      }),
      "u1",
      "b1"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WINDOW_NOT_OPEN");
  });

  it("free tier: 3 of 3 used -> NO_SESSIONS_LEFT (cap retained)", async () => {
    const r = await checkBraidcareEligibility(
      fakeSupabase({
        booking: {
          id: "b1",
          status: "confirmed",
          braidcare_live_at: past,
          sessions_allocated: 3,
          sessions_used: 3,
        },
      }),
      "u1",
      "b1"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NO_SESSIONS_LEFT");
  });

  it("free tier: window open, 1 of 3 used -> eligible, capped", async () => {
    const r = await checkBraidcareEligibility(
      fakeSupabase({
        booking: {
          id: "b1",
          status: "confirmed",
          braidcare_live_at: past,
          sessions_allocated: 3,
          sessions_used: 1,
        },
      }),
      "u1",
      "b1"
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reason).toBe("free_booking_window");
  });

  it("free tier: unconfirmed booking -> BOOKING_NOT_CONFIRMED", async () => {
    const r = await checkBraidcareEligibility(
      fakeSupabase({
        booking: {
          id: "b1",
          status: "pending",
          braidcare_live_at: past,
          sessions_allocated: 3,
          sessions_used: 0,
        },
      }),
      "u1",
      "b1"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BOOKING_NOT_CONFIRMED");
  });
});
