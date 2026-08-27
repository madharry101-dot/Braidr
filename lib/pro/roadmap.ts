import type { AssessmentInput } from "@/lib/validations/pro";

export type RoadmapStep = {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  self_reported_done: boolean | null;
  completed_in_app: boolean;
};

type ProgressRow = {
  step2_hmrc_completed: boolean;
  step3_insurance_completed: boolean;
  step4_banking_completed: boolean;
  step5_accessed: boolean;
};

/**
 * PRD FR-PRO-01.6 — "personalised roadmap showing which steps the braider
 * has already completed and which remain". The assessment answers
 * (self_reported_done) are informational only — they personalise the
 * roadmap's framing ("you told us you're already registered") but don't
 * auto-complete a step. Each step still requires its own explicit in-app
 * action (UTR confirmation, insurance upload, etc. — see PUT
 * /api/pro/steps/:step) before completed_in_app flips to true, since those
 * steps carry their own data (a real UTR, an actual uploaded document) that
 * a yes/no quiz answer can't substitute for.
 */
export function buildRoadmap(assessment: AssessmentInput, progress: ProgressRow): RoadmapStep[] {
  return [
    { step: 1, title: "Readiness Assessment", self_reported_done: null, completed_in_app: true },
    {
      step: 2,
      title: "HMRC Registration",
      self_reported_done: assessment.hmrc_registered,
      completed_in_app: progress.step2_hmrc_completed,
    },
    {
      step: 3,
      title: "Professional Insurance",
      self_reported_done: assessment.has_insurance,
      completed_in_app: progress.step3_insurance_completed,
    },
    {
      step: 4,
      title: "Business Identity",
      self_reported_done: assessment.has_business_bank_account,
      completed_in_app: progress.step4_banking_completed,
    },
    {
      step: 5,
      title: "Growth & CPD",
      self_reported_done: null,
      completed_in_app: progress.step5_accessed,
    },
  ];
}
