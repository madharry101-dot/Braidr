import { test, expect } from "@playwright/test";

// B5 — referral link handler (FR-REF-01.3).

test.describe("/r/[code] referral links", () => {
  test("an unknown code redirects to /register with no ref cookie", async ({ page, context }) => {
    await page.goto("/r/NOTACODE");
    await expect(page).toHaveURL(/\/register$/);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "braidr_ref")).toBeUndefined();
  });

  test("/register still shows the create-account form when reached via /r/", async ({ page }) => {
    await page.goto("/r/NOTACODE");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });
});
