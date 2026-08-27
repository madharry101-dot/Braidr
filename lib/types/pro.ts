export type AssessmentAnswers = {
  hmrc_registered: boolean;
  has_insurance: boolean;
  has_business_bank_account: boolean;
  files_tax_return: boolean;
  tracks_income: boolean;
};

export type ProProgress = {
  assessment_completed: boolean;
  assessment_results: AssessmentAnswers | null;
  step2_hmrc_completed: boolean;
  step3_insurance_completed: boolean;
  step4_banking_completed: boolean;
  step4_badge_awarded: boolean;
  step5_accessed: boolean;
  overall_progress_pct: number;
  utr_masked: string | null;
};

export type ProProgressResponse = { progress: ProProgress | null; started: boolean };

export type IncomeRecord = {
  id: string;
  booking_id: string;
  service_name: string;
  gross_amount_pence: number;
  commission_pence: number;
  net_amount_pence: number;
  tax_year: string;
  payment_date: string;
};

export type TaxYearSummary = {
  tax_year: string;
  total_gross_pence: number;
  total_net_pence: number;
  estimated_tax_pence: number;
};

export type IncomeResponse = {
  records: IncomeRecord[];
  tax_year_summaries: TaxYearSummary[];
  disclaimer: string;
};

export const ASSESSMENT_QUESTIONS: { key: keyof AssessmentAnswers; label: string }[] = [
  { key: "hmrc_registered", label: "Are you registered as self-employed with HMRC?" },
  { key: "has_insurance", label: "Do you have professional / public liability insurance?" },
  {
    key: "has_business_bank_account",
    label: "Do you use a separate bank account for your braiding income?",
  },
  { key: "files_tax_return", label: "Have you filed a Self Assessment tax return before?" },
  { key: "tracks_income", label: "Do you keep a record of what you earn?" },
];

export const PRO_STEPS: { step: 2 | 3 | 4 | 5; title: string; blurb: string }[] = [
  {
    step: 2,
    title: "HMRC registration",
    blurb: "Register as self-employed and add your UTR (Unique Taxpayer Reference).",
  },
  {
    step: 3,
    title: "Professional insurance",
    blurb: "Upload proof of public liability / professional indemnity cover.",
  },
  {
    step: 4,
    title: "Business identity",
    blurb:
      "Open a separate account for your braiding income. Completing this earns your Braidr-verified badge.",
  },
  {
    step: 5,
    title: "Growth & CPD",
    blurb: "Ongoing learning, pricing guidance and ways to grow your client base.",
  },
];

export const PRO_INCOME_DISCLAIMER =
  "Income record only. Braidr does not provide financial or tax advice — speak to an accountant about your Self Assessment.";
