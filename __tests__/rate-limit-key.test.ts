import { identifierForEmail } from "@/lib/api/rate-limit";

// R-08, the other half: the per-address rate-limit key. The address itself
// must not end up in an Upstash key, and the key must not depend on how the
// caller happened to type the address — otherwise "A@x.com" and "a@x.com "
// get separate buckets and the limit is trivially sidestepped.
describe("identifierForEmail", () => {
  it("is stable for the same address", () => {
    expect(identifierForEmail("adaeze@example.com")).toBe(identifierForEmail("adaeze@example.com"));
  });

  it.each([" adaeze@example.com", "Adaeze@Example.com", "ADAEZE@EXAMPLE.COM  "])(
    "normalises case and whitespace: %p",
    (variant) => {
      expect(identifierForEmail(variant)).toBe(identifierForEmail("adaeze@example.com"));
    }
  );

  it("differs for different addresses", () => {
    expect(identifierForEmail("a@example.com")).not.toBe(identifierForEmail("b@example.com"));
  });

  it("does not contain the address", () => {
    const key = identifierForEmail("adaeze@example.com");
    expect(key).not.toContain("adaeze");
    expect(key).not.toContain("@");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });
});
