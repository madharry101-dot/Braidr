import { test, expect } from "@playwright/test";

// Regression guard for the two pages flagged in the v2 gap analysis as
// "renders only legal text" (/login) and "completely blank" (/braiders).
// Neither is reproducible today; these tests assert the real content is
// present post-hydration so a future bundle/hydration break is caught in CI
// rather than by a user. See braidr-v2-implementation-plan.md §1.6 / R5.

test.describe("/login renders a usable form", () => {
  test("email, password, and submit are visible and interactive", async ({ page }) => {
    await page.goto("/login");

    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");
    const submit = page.getByRole("button", { name: "Sign in" });

    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(submit).toBeVisible();

    // Prove hydration actually ran — a server-only render can't accept input.
    await email.fill("someone@example.com");
    await expect(email).toHaveValue("someone@example.com");

    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  });
});

test.describe("auth pages carry the v2 additions", () => {
  test("/login and /register both offer Continue with Google", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();

    await page.goto("/register");
    await expect(page.getByRole("button", { name: /sign up with google/i })).toBeVisible();
  });

  test("/register gates the submit on Terms consent (GDPR-01)", async ({ page }) => {
    await page.goto("/register");
    const submit = page.getByRole("button", { name: "Create account" });
    const terms = page.getByLabel(/I agree to the/i);

    await expect(terms).not.toBeChecked();
    await expect(submit).toBeDisabled();
    await terms.check();
    await expect(submit).toBeEnabled();
  });

  test("/forgot-password renders (route renamed from /reset-password)", async ({ page }) => {
    const res = await page.goto("/forgot-password");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  });
});

test.describe("/dashboard routes by role", () => {
  test("unauthenticated /dashboard redirects to login (server-side)", async ({ page }) => {
    const res = await page.goto("/dashboard");
    // middleware.ts issues a real 307 before any layout renders.
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("/braiders is never a blank page", () => {
  test("unauthenticated visit lands on a working login form, not nothing", async ({ page }) => {
    await page.goto("/braiders");

    // AppShell client-guards unauthenticated users to /login with a redirect
    // param — the point is the user always reaches usable content, never a
    // blank page. Generous timeout: a cold dev server compiles /braiders,
    // /api/auth/session, then /login in sequence on this path.
    await page.waitForURL(/\/login(\?|$)/, { timeout: 30_000 });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
