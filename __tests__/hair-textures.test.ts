import {
  HAIR_TEXTURES,
  HAIR_TYPE_LABEL,
  isHairTexture,
  resolveQuiz,
  TEXTURE_META,
} from "@/lib/hair/textures";

describe("hair texture vocabulary", () => {
  it("has metadata for every texture", () => {
    for (const t of HAIR_TEXTURES) {
      expect(TEXTURE_META[t].label).toBeTruthy();
      expect(TEXTURE_META[t].desc).toBeTruthy();
      expect(TEXTURE_META[t].braiderBlurb).toBeTruthy();
      expect(HAIR_TYPE_LABEL[t]).toBe(TEXTURE_META[t].label);
    }
  });

  it("rejects the legacy Type 1-4 values", () => {
    expect(isHairTexture("Type 1")).toBe(false);
    expect(isHairTexture("prefer_not_to_say")).toBe(false);
    expect(isHairTexture(null)).toBe(false);
    expect(isHairTexture("coily")).toBe(true);
  });
});

describe("resolveQuiz", () => {
  it("returns the shared answer when both questions agree", () => {
    for (const t of HAIR_TEXTURES) {
      expect(resolveQuiz(t, t)).toBe(t);
    }
  });

  it("errs toward the coilier answer when they disagree", () => {
    // Shrinkage is the stronger signal for braid prep, and under-preparing
    // for a tighter texture is the worse failure — so the tighter of the
    // two answers wins, in either order.
    expect(resolveQuiz("straight", "coily")).toBe("coily");
    expect(resolveQuiz("coily", "straight")).toBe("coily");
    expect(resolveQuiz("wavy", "curly")).toBe("curly");
    expect(resolveQuiz("curly", "wavy")).toBe("curly");
  });

  it("only ever returns one of the four stored categories", () => {
    for (const a of HAIR_TEXTURES) {
      for (const b of HAIR_TEXTURES) {
        expect(HAIR_TEXTURES).toContain(resolveQuiz(a, b));
      }
    }
  });
});
