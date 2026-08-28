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
