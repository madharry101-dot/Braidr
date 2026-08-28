import { z } from "zod";
import { validate } from "@/lib/api/validate";
import { registerSchema } from "@/lib/validations/auth";

describe("API validation wrapper (TRD 4.1.1 envelope)", () => {
  it("passes through valid input", () => {
    const result = validate(registerSchema, {
      email: "Adaeze@Example.com",
      password: "correct-horse-battery",
      full_name: "Adaeze",
      role: "client",
      accepted_terms: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe("adaeze@example.com"); // normalised
      expect(result.data.marketing_opt_in).toBe(false); // defaults off (GDPR-02)
    }
  });

  it("rejects registration without Terms/Privacy consent (GDPR-01)", () => {
    const result = validate(registerSchema, {
      email: "adaeze@example.com",
      password: "correct-horse-battery",
      full_name: "Adaeze",
      role: "client",
      accepted_terms: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(422);
  });

  it("returns a 422 envelope with a field name on invalid input", async () => {
    const result = validate(registerSchema, {
      email: "not-an-email",
      password: "x",
      full_name: "",
      role: "client",
      accepted_terms: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      const body = await result.response.json();
      expect(body).toEqual({
        success: false,
        error: { code: "VALIDATION_ERROR", message: expect.any(String), field: expect.any(String) },
      });
    }
  });

  it("rejects an unknown role", () => {
    const schema = z.object({ role: z.enum(["client", "braider", "expert"]) });
    const result = validate(schema, { role: "admin" });
    expect(result.ok).toBe(false);
  });
});
