import { computeBookingPricing } from "@/lib/bookings/pricing";
import { ukTaxYearFor } from "@/lib/bookings/tax-year";

describe("computeBookingPricing", () => {
  it("applies the 12% standard rate", () => {
    const result = computeBookingPricing(8000, false);
    expect(result).toEqual({
      amount_pence: 8000,
      commission_pence: 960,
      braider_payout_pence: 7040,
    });
  });

  it("applies the 5% Pro rate", () => {
    const result = computeBookingPricing(8000, true);
    expect(result).toEqual({
      amount_pence: 8000,
      commission_pence: 400,
      braider_payout_pence: 7600,
    });
  });

  it("rounds commission to the nearest penny", () => {
    const result = computeBookingPricing(8333, false);
    expect(result.commission_pence).toBe(Math.round(8333 * 0.12));
    expect(result.commission_pence + result.braider_payout_pence).toBe(8333);
  });
});

describe("ukTaxYearFor", () => {
  it("returns the prior tax year just before April 6", () => {
    expect(ukTaxYearFor(new Date("2026-04-05T23:00:00Z"))).toBe("2025-26");
  });

  it("returns the new tax year from April 6 onward", () => {
    expect(ukTaxYearFor(new Date("2026-04-06T00:00:00Z"))).toBe("2026-27");
  });

  it("handles a mid-year date", () => {
    expect(ukTaxYearFor(new Date("2026-08-26T12:00:00Z"))).toBe("2026-27");
  });
});
