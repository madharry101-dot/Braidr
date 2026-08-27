import { computeReferralSuggested, type ScalpAnalysisResult } from "@/lib/ai/braidcare";

function baseResult(overrides: Partial<ScalpAnalysisResult> = {}): ScalpAnalysisResult {
  return {
    overall_status: "looking_good",
    summary: "All good.",
    flags: [],
    recommendations: [],
    referral_suggested: false,
    ...overrides,
  };
}

describe("computeReferralSuggested (TRD 5.3.4)", () => {
  it("suggests a referral when overall_status is seek_specialist", () => {
    const result = computeReferralSuggested(baseResult({ overall_status: "seek_specialist" }));
    expect(result.suggested).toBe(true);
  });

  it("suggests a referral when any flag is high severity", () => {
    const result = computeReferralSuggested(
      baseResult({ flags: [{ area: "crown", observation: "x", severity: "high", action: "y" }] })
    );
    expect(result.suggested).toBe(true);
    expect(result.reason).toContain("crown");
  });

  it("suggests a referral when 3+ flags include a medium", () => {
    const result = computeReferralSuggested(
      baseResult({
        flags: [
          { area: "a", observation: "x", severity: "low", action: "y" },
          { area: "b", observation: "x", severity: "medium", action: "y" },
          { area: "c", observation: "x", severity: "low", action: "y" },
        ],
      })
    );
    expect(result.suggested).toBe(true);
  });

  it("does NOT suggest a referral for 2 low-severity flags", () => {
    const result = computeReferralSuggested(
      baseResult({
        flags: [
          { area: "a", observation: "x", severity: "low", action: "y" },
          { area: "b", observation: "x", severity: "low", action: "y" },
        ],
      })
    );
    expect(result.suggested).toBe(false);
  });

  it("overrides the model's own referral_suggested=false when the threshold is met", () => {
    // The model's own boolean is deliberately NOT trusted alone — this is
    // the safety property the whole function exists to guarantee.
    const result = computeReferralSuggested(
      baseResult({
        overall_status: "seek_specialist",
        referral_suggested: false,
      })
    );
    expect(result.suggested).toBe(true);
  });

  it("suggests a referral when the model populates referral_reason even without other triggers", () => {
    const result = computeReferralSuggested(
      baseResult({ referral_reason: "Model flagged a concern." })
    );
    expect(result.suggested).toBe(true);
    expect(result.reason).toBe("Model flagged a concern.");
  });
});
