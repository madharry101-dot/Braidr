import sharp from "sharp";
import { getAnthropicClient } from "@/lib/ai/anthropic";

// TRD 5.2 — BraidMatch style identification.
export const STYLE_CATEGORIES = [
  "knotless_braids",
  "box_braids",
  "cornrows",
  "locs",
  "twists",
  "weave",
  "faux_locs",
  "fulani_braids",
  "senegalese_twists",
  "other",
  "unclear",
] as const;
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

export type StyleMatchResult = {
  style_category: StyleCategory;
  style_label: string;
  confidence: number;
  search_tags: string[];
};

const SYSTEM_PROMPT = `You are a hair braiding style identification specialist.
Analyse the provided photograph and identify the hair braiding style shown.

Use the identify_style tool to return your analysis.
Be precise. If the style is unclear or the image does not show a braiding style, return
style_category as "unclear" and confidence below 0.5.
Do not guess. Do not diagnose any scalp conditions.`;

const TOOL_DEFINITION = {
  name: "identify_style",
  description: "Identify the hair braiding style in the image",
  input_schema: {
    type: "object" as const,
    properties: {
      style_category: { type: "string" as const, enum: [...STYLE_CATEGORIES] },
      style_label: { type: "string" as const },
      confidence: { type: "number" as const, minimum: 0, maximum: 1 },
      search_tags: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["style_category", "style_label", "confidence", "search_tags"],
  },
};

/** Resizes to max 1024px (TRD 5.2.1) and re-encodes as JPEG for a consistent, small payload. */
async function preprocessImage(
  buffer: Buffer
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const resized = await sharp(buffer)
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { base64: resized.toString("base64"), mediaType: "image/jpeg" };
}

export async function identifyStyle(imageBuffer: Buffer): Promise<StyleMatchResult> {
  const { base64, mediaType } = await preprocessImage(imageBuffer);

  const message = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "identify_style" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Identify the braiding style in this photo." },
        ],
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // TRD 5.4: "No braiding-related content in style match photo" fallback.
    return { style_category: "unclear", style_label: "Unclear", confidence: 0, search_tags: [] };
  }

  return toolUse.input as StyleMatchResult;
}
