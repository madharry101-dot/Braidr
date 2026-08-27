import sharp from "sharp";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BraidcareOverallStatus, ConditionFlag } from "@/types/database";

// TRD 5.3 — BraidCare scalp health analysis. Verbatim from the TRD; do not
// edit the wording casually — the "NOT a medical device" / no-diagnosis
// constraints here are what keeps BraidCare outside MHRA medical device
// classification (concept doc "Key Decisions": "No diagnosis language").
const SYSTEM_PROMPT = `You are BraidCare, a scalp wellness monitoring assistant for Braidr.
You analyse scalp photographs taken by clients between hair braiding appointments.

IMPORTANT CONSTRAINTS:
- You are a wellness monitoring tool, NOT a medical device.
- You MUST NOT diagnose any medical condition.
- You MUST NOT use clinical diagnosis language (e.g. "you have traction alopecia").
- Use observational language: "areas of tension", "signs of dryness", "reduced density".
- If you observe significant indicators, recommend consulting a scalp health specialist.
- Your recommendations should be practical haircare aftercare advice.

WHAT YOU CAN FLAG:
- Visible scalp tension patterns at follicle level
- Dryness, flaking, or irritation at the scalp surface
- Uneven density or thinning in visible areas
- Redness or inflammation at the hairline or parting lines
- Signs that a rest period from braiding may be beneficial

Use the analyse_scalp tool to return your structured assessment.
Be specific about which area of the scalp is affected (e.g. "frontal hairline", "crown", "left temple").
Keep recommendations practical, friendly, and non-alarmist.`;

const TOOL_DEFINITION = {
  name: "analyse_scalp",
  description: "Return structured scalp wellness assessment",
  input_schema: {
    type: "object" as const,
    properties: {
      overall_status: {
        type: "string" as const,
        enum: ["looking_good", "monitor_closely", "consider_rest", "seek_specialist"],
      },
      summary: { type: "string" as const, maxLength: 300 },
      flags: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            area: { type: "string" as const },
            observation: { type: "string" as const },
            severity: { type: "string" as const, enum: ["low", "medium", "high"] },
            action: { type: "string" as const },
          },
          required: ["area", "observation", "severity", "action"],
        },
      },
      recommendations: { type: "array" as const, items: { type: "string" as const }, maxItems: 5 },
      referral_suggested: { type: "boolean" as const },
      referral_reason: { type: "string" as const },
    },
    required: ["overall_status", "summary", "flags", "recommendations", "referral_suggested"],
  },
};

export type ScalpAnalysisResult = {
  overall_status: BraidcareOverallStatus;
  summary: string;
  flags: ConditionFlag[];
  recommendations: string[];
  referral_suggested: boolean;
  referral_reason?: string;
};

/** TRD 5.3.1: resize to max 1568px, JPEG 85%, strip EXIF (sharp strips metadata by default on re-encode). */
async function preprocessImage(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return resized.toString("base64");
}

export async function analyseScalp(imageBuffers: Buffer[]): Promise<ScalpAnalysisResult> {
  const images = await Promise.all(imageBuffers.map(preprocessImage));

  const message = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "analyse_scalp" },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((base64) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data: base64 },
          })),
          { type: "text" as const, text: "Analyse the scalp condition shown in these photos." },
        ],
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a tool_use block");
  }

  return toolUse.input as ScalpAnalysisResult;
}

/**
 * TRD 5.3.4 — computed independently of the model's own referral_suggested
 * boolean, not just read from it. These four conditions ARE the definition
 * of when a referral is warranted; trusting the model's self-assessment
 * alone for something with clinical-adjacent consequences would be the
 * wrong safety posture for a wellness tool that explicitly must not
 * diagnose but must reliably flag when a human specialist should look.
 */
export function computeReferralSuggested(result: ScalpAnalysisResult): {
  suggested: boolean;
  reason: string | null;
} {
  const hasHighSeverity = result.flags.some((f) => f.severity === "high");
  const hasThreeOrMoreWithMedium =
    result.flags.length >= 3 && result.flags.some((f) => f.severity === "medium");

  if (result.overall_status === "seek_specialist") {
    return {
      suggested: true,
      reason: result.referral_reason ?? "Overall status indicated seek_specialist.",
    };
  }
  if (hasHighSeverity) {
    const flag = result.flags.find((f) => f.severity === "high")!;
    return { suggested: true, reason: `High severity flag: ${flag.area} — ${flag.observation}` };
  }
  if (hasThreeOrMoreWithMedium) {
    return { suggested: true, reason: "Three or more flags with at least one medium severity." };
  }
  if (result.referral_reason) {
    return { suggested: true, reason: result.referral_reason };
  }
  return { suggested: false, reason: null };
}
