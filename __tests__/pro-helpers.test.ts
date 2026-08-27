import { isReminderDay } from "@/lib/pro/hmrc-deadlines";
import { buildRoadmap } from "@/lib/pro/roadmap";

describe("isReminderDay (PRD FR-PRO-03.5)", () => {
  it("flags exactly 60 days before 31 January", () => {
    const { isReminderDay: flagged, deadline } = isReminderDay(new Date("2026-12-02T12:00:00Z"));
    expect(flagged).toBe(true);
    expect(deadline.toISOString().slice(0, 10)).toBe("2027-01-31");
  });

  it("flags exactly 7 days before 31 July", () => {
    const { isReminderDay: flagged, deadline } = isReminderDay(new Date("2026-07-24T00:00:00Z"));
    expect(flagged).toBe(true);
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-07-31");
  });

  it("does not flag an arbitrary day (e.g. 45 days out)", () => {
    const { isReminderDay: flagged } = isReminderDay(new Date("2026-12-17T00:00:00Z"));
    expect(flagged).toBe(false);
  });

  it("does not flag the day after a reminder day", () => {
    const { isReminderDay: flagged } = isReminderDay(new Date("2026-07-25T00:00:00Z"));
    expect(flagged).toBe(false);
  });
});

describe("buildRoadmap (PRD FR-PRO-01.6)", () => {
  const assessment = {
    hmrc_registered: true,
    has_insurance: false,
    has_business_bank_account: false,
    files_tax_return: true,
    tracks_income: false,
  };
  const progress = {
    step2_hmrc_completed: false,
    step3_insurance_completed: false,
    step4_banking_completed: false,
    step5_accessed: false,
  };

  it("shows self-reported status without auto-completing the in-app step", () => {
    const roadmap = buildRoadmap(assessment, progress);
    const step2 = roadmap.find((s) => s.step === 2)!;
    expect(step2.self_reported_done).toBe(true);
    expect(step2.completed_in_app).toBe(false); // still requires the actual UTR confirmation
  });

  it("step 1 is always shown as completed (the assessment itself)", () => {
    const roadmap = buildRoadmap(assessment, progress);
    expect(roadmap.find((s) => s.step === 1)!.completed_in_app).toBe(true);
  });
});
