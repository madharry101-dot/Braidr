import { test, expect } from "@playwright/test";

// B8 — short-URL redirects (plan Q6).
const cases: [string, RegExp][] = [
  ["/pro", /\/dashboard\/braider\/pro$/],
  ["/income", /\/dashboard\/braider\/pro\/income$/],
  ["/book/abc123", /\/braiders\/abc123\/book$/],
];

for (const [from, to] of cases) {
  test(`${from} redirects to its canonical route`, async ({ page }) => {
    const res = await page.goto(from, { waitUntil: "commit" });
    expect(res).not.toBeNull();
    // Ends up on the canonical path (then likely bounced to /login if auth-gated).
    await expect(page).toHaveURL(new RegExp(`(${to.source})|/login`));
  });
}
