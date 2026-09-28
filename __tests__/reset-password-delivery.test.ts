// R-08. Covers the part of the reset-password flow that runs AFTER the
// response has been sent, where nothing is awaiting the result and a failure
// is invisible unless it announces itself.

const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockSend } })),
}));

type Delivery = typeof import("@/lib/auth/reset-password-delivery");

async function load(): Promise<Delivery> {
  // Re-imported per test so lib/email/send.ts re-reads RESEND_API_KEY, which
  // it captures at module load.
  return import("@/lib/auth/reset-password-delivery");
}

function fakeSupabase(impl?: () => Promise<unknown>) {
  const resetPasswordForEmail = jest.fn(impl ?? (() => Promise.resolve({ error: null })));
  return { client: { auth: { resetPasswordForEmail } }, resetPasswordForEmail };
}

describe("deliverPasswordReset", () => {
  let info: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    mockSend.mockResolvedValue({ id: "email_123" });
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://braidr.netlify.app";
    info = jest.spyOn(console, "info").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    info.mockRestore();
    error.mockRestore();
  });

  describe("Google-only account", () => {
    it("sends the Google sign-in notice and no reset link", async () => {
      const { deliverPasswordReset } = await load();
      const { client, resetPasswordForEmail } = fakeSupabase();

      await deliverPasswordReset({
        email: "adaeze@example.com",
        googleOnly: true,
        supabase: client,
        redirectTo: "https://braidr.netlify.app/reset-password",
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(resetPasswordForEmail).not.toHaveBeenCalled();

      const sent = mockSend.mock.calls[0][0];
      expect(sent.to).toBe("adaeze@example.com");
      expect(sent.subject).toBe("Signing in to Braidr");
      expect(sent.text).toContain("Continue with Google");
      expect(sent.text).toContain("https://braidr.netlify.app/login");
    });

    it("never states that the account exists in the abstract — it addresses the owner", async () => {
      const { deliverPasswordReset } = await load();
      await deliverPasswordReset({
        email: "adaeze@example.com",
        googleOnly: true,
        supabase: fakeSupabase().client,
        redirectTo: "x",
      });
      const { text } = mockSend.mock.calls[0][0];
      // Gender-neutral: the copy must not assume a gender for the reader.
      expect(text).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
      // Brand voice: banned phrases that must never reappear anywhere.
      for (const banned of ["verified in person", "dermatologist-backed", "free consultation"]) {
        expect(text.toLowerCase()).not.toContain(banned);
      }
      expect(text).toContain("you can ignore this email");
    });
  });

  describe("password account or unknown address", () => {
    it("asks Supabase for a reset link and sends no notice", async () => {
      const { deliverPasswordReset } = await load();
      const { client, resetPasswordForEmail } = fakeSupabase();

      await deliverPasswordReset({
        email: "someone@example.com",
        googleOnly: false,
        supabase: client,
        redirectTo: "https://braidr.netlify.app/reset-password",
      });

      expect(resetPasswordForEmail).toHaveBeenCalledWith("someone@example.com", {
        redirectTo: "https://braidr.netlify.app/reset-password",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("a failure after the response has gone out", () => {
    it("logs loudly when the Google notice cannot be sent", async () => {
      mockSend.mockRejectedValue(new Error("Resend is down"));
      const { deliverPasswordReset } = await load();

      await expect(
        deliverPasswordReset({
          email: "adaeze@example.com",
          googleOnly: true,
          supabase: fakeSupabase().client,
          redirectTo: "x",
        })
      ).resolves.toBeUndefined(); // must not become an unhandled rejection

      expect(error).toHaveBeenCalledWith(
        "[reset-password] post-response delivery FAILED",
        expect.objectContaining({ google_only: true, error: "Resend is down" })
      );
    });

    it("logs loudly when the reset link cannot be sent", async () => {
      const { deliverPasswordReset } = await load();
      const { client } = fakeSupabase(() => Promise.reject(new Error("GoTrue timeout")));

      await deliverPasswordReset({
        email: "someone@example.com",
        googleOnly: false,
        supabase: client,
        redirectTo: "x",
      });

      expect(error).toHaveBeenCalledWith(
        "[reset-password] post-response delivery FAILED",
        expect.objectContaining({ google_only: false, error: "GoTrue timeout" })
      );
    });

    it("does not claim success when the send failed", async () => {
      mockSend.mockRejectedValue(new Error("nope"));
      const { deliverPasswordReset } = await load();
      await deliverPasswordReset({
        email: "a@example.com",
        googleOnly: true,
        supabase: fakeSupabase().client,
        redirectTo: "x",
      });
      const infoMessages = info.mock.calls.map((c) => c[0]);
      expect(infoMessages).toContain("[reset-password] post-response delivery starting");
      expect(infoMessages).not.toContain("[reset-password] post-response delivery done");
    });
  });

  // The whole point of the bracketing logs: if after() stops running on the
  // platform, "starting" never appears, and that absence is the only signal
  // anyone would ever get.
  it("announces itself before doing any work", async () => {
    const { deliverPasswordReset } = await load();
    await deliverPasswordReset({
      email: "a@example.com",
      googleOnly: false,
      supabase: fakeSupabase().client,
      redirectTo: "x",
    });
    expect(info).toHaveBeenNthCalledWith(1, "[reset-password] post-response delivery starting", {
      google_only: false,
    });
  });
});
