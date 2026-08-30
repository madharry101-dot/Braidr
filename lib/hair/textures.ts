// PART 1 — Hair Type System. Single source of truth for the plain-language
// texture vocabulary, shared by the client hair-type picker, the braider
// specialisations step, BraidMatch search and the braider confirmation flow.
//
// Deliberately plain-language, not the Andre-Walker "Type 1–4" system —
// clients often don't know the technical classification. `hair_type_detail`
// (reserved in the schema) is where 3a/3b/4c etc. will live later.

export const HAIR_TEXTURES = ["straight", "wavy", "curly", "coily"] as const;
export type HairTexture = (typeof HAIR_TEXTURES)[number];

/** The value stored in profiles.hair_type. NULL in the DB = "not set". */
export type HairTypeValue = HairTexture | "prefer_not_to_say";

export function isHairTexture(v: string | null | undefined): v is HairTexture {
  return v != null && (HAIR_TEXTURES as readonly string[]).includes(v);
}

type TextureMeta = {
  /** Short label shown on cards, badges and filters. */
  label: string;
  /** One-line plain-language description (client selector). */
  desc: string;
  /** Longer description shown when a braider expands the option (education
   *  delivered at the point of selection — see the brief). */
  braiderBlurb: string;
};

export const TEXTURE_META: Record<HairTexture, TextureMeta> = {
  straight: {
    label: "Straight",
    desc: "Lies flat, no curl",
    braiderBlurb: "Lies flat with no natural curl or wave.",
  },
  wavy: {
    label: "Wavy",
    desc: "Loose S-shaped waves",
    braiderBlurb: "Loose, S-shaped waves — more body than straight, no defined curl.",
  },
  curly: {
    label: "Curly",
    desc: "Defined curls or ringlets",
    braiderBlurb: "Defined curls, from loose loops to tight corkscrews.",
  },
  coily: {
    label: "Coily / Kinky",
    desc: "Tight coils, shrinks noticeably when dry",
    braiderBlurb:
      "Tightly coiled, the most fragile texture, shrinks significantly when dry. Most box braids, cornrows and twist work is done on this texture.",
  },
};

export const HAIR_TYPE_LABEL: Record<HairTypeValue, string> = {
  straight: TEXTURE_META.straight.label,
  wavy: TEXTURE_META.wavy.label,
  curly: TEXTURE_META.curly.label,
  coily: TEXTURE_META.coily.label,
  prefer_not_to_say: "Prefer not to say",
};

// ── "Not sure — help me figure it out" guided flow ──────────────────────
// Two questions, four options each, both mapping onto the same four
// categories. The result is the coilier of the two answers — a wet-and-
// stretched pattern plus how much it shrinks together pin the texture down
// better than either alone, and erring toward the tighter texture is the
// safer default for braid prep.

export type QuizAnswer = HairTexture;

export const HAIR_QUIZ = {
  q1: {
    prompt:
      "When your hair is wet and stretched out, does it fall straight, wave, curl, or coil back up tightly?",
    options: [
      { value: "straight" as const, label: "Falls straight" },
      { value: "wavy" as const, label: "Loose S-shaped wave" },
      { value: "curly" as const, label: "Springs into curls or ringlets" },
      { value: "coily" as const, label: "Coils back up tightly" },
    ],
  },
  q2: {
    prompt: "How much does your hair shrink when it dries, compared to its stretched length?",
    options: [
      { value: "straight" as const, label: "Barely at all" },
      { value: "wavy" as const, label: "A little" },
      { value: "curly" as const, label: "Noticeably" },
      { value: "coily" as const, label: "A lot" },
    ],
  },
} as const;

/** Map the two guided-flow answers to one stored category. */
export function resolveQuiz(q1: QuizAnswer, q2: QuizAnswer): HairTexture {
  const a = HAIR_TEXTURES.indexOf(q1);
  const b = HAIR_TEXTURES.indexOf(q2);
  return HAIR_TEXTURES[Math.max(a, b)];
}
