import { isAlreadyRegistered, publicSignUpError } from "@/lib/auth/signup-errors";

// R-08. The register route must answer identically whether or not an address
// is already registered. These pin the two halves of that: recognising the
// "already exists" result, and never letting an unrecognised upstream message
// reach the caller.

describe("isAlreadyRegistered", () => {
  it.each(["user_already_exists", "email_exists"])("recognises the %s code", (code) => {
    expect(isAlreadyRegistered({ code, message: "anything" })).toBe(true);
  });

  // Older GoTrue returned the message with no machine-readable code.
  it.each([
    "User already registered",
    "user already registered",
    "A user with this email address already exists",
  ])('falls back to the message: "%s"', (message) => {
    expect(isAlreadyRegistered({ message })).toBe(true);
  });

  it.each([
    { code: "email_address_invalid", message: "Email address is invalid" },
    { code: "weak_password", message: "Password is too weak" },
    { message: "Database connection failed" },
  ])("does not fire on unrelated errors (%p)", (error) => {
    expect(isAlreadyRegistered(error)).toBe(false);
  });

  it.each([null, undefined, {}])("handles %p", (error) => {
    expect(isAlreadyRegistered(error)).toBe(false);
  });
});

describe("publicSignUpError", () => {
  it("passes through errors that describe the caller's own input", () => {
    expect(publicSignUpError({ code: "email_address_invalid" }).field).toBe("email");
    expect(publicSignUpError({ code: "weak_password" }).field).toBe("password");
  });

  it("collapses an unrecognised code to the generic message", () => {
    const { message } = publicSignUpError({ code: "some_future_supabase_code" });
    expect(message).toBe("We couldn't complete your registration. Please try again.");
  });

  it("collapses an error with no code at all", () => {
    expect(publicSignUpError({ message: "raw upstream detail" }).message).toBe(
      "We couldn't complete your registration. Please try again."
    );
  });

  // Belt and braces. The route returns success for these before ever calling
  // this, but if that branch is ever removed, the message must still not
  // confirm the address exists.
  it.each(["user_already_exists", "email_exists"])(
    "never leaks existence for %s, even though the route should not reach here",
    (code) => {
      const { message } = publicSignUpError({ code, message: "User already registered" });
      expect(message).not.toMatch(/already|registered|exists|taken/i);
      expect(message).toBe("We couldn't complete your registration. Please try again.");
    }
  );

  it("never returns the upstream message verbatim", () => {
    const upstream = "User already registered";
    expect(publicSignUpError({ code: "user_already_exists", message: upstream }).message).not.toBe(
      upstream
    );
  });
});
