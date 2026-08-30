import { subscribeNewsletterSchema } from "@/lib/validations/newsletter";
import { NEWSLETTER_MAX_PER_MONTH } from "@/lib/newsletter/copy";
import { NEWSLETTER_VERSION } from "@/lib/consent/versions";
import { notificationEventsFor } from "@/lib/settings/notifications";
import type { Role } from "@/types/database";

// These pin down the compliance posture, not the plumbing. Each one is a
// rule that would be a PECR/GDPR problem if a later refactor broke it
// quietly.

describe("newsletter opt-in is affirmative", () => {
  it("requires `subscribed` to be stated — there is no default-on", () => {
    expect(subscribeNewsletterSchema.safeParse({}).success).toBe(false);
    expect(subscribeNewsletterSchema.safeParse({ subscribed: true }).success).toBe(true);
    expect(subscribeNewsletterSchema.safeParse({ subscribed: false }).success).toBe(true);
  });

  it("sets an explicit state rather than toggling, so a replay is idempotent", () => {
    const first = subscribeNewsletterSchema.parse({ subscribed: false });
    const replay = subscribeNewsletterSchema.parse({ subscribed: false });
    expect(first.subscribed).toBe(replay.subscribed);
  });

  it("records where consent was captured, defaulting to the settings page", () => {
    expect(subscribeNewsletterSchema.parse({ subscribed: true }).consent_source).toBe(
      "settings_page"
    );
    expect(
      subscribeNewsletterSchema.parse({ subscribed: true, consent_source: "blog_signup_form" })
        .consent_source
    ).toBe("blog_signup_form");
  });

  it("rejects an unrecognised consent source", () => {
    expect(
      subscribeNewsletterSchema.safeParse({ subscribed: true, consent_source: "imported_list" })
        .success
    ).toBe(false);
  });
});

describe("newsletter is kept apart from transactional mail", () => {
  it("is not a row in the opt-out notification list", () => {
    // The transactional list defaults to ON, which is lawful because those
    // messages are part of the service. Marketing must never inherit that
    // default by being added to the same list.
    const roles: Role[] = ["client", "braider", "expert", "admin"];
    for (const role of roles) {
      for (const event of notificationEventsFor(role)) {
        expect(event.key.toLowerCase()).not.toContain("newsletter");
        expect(event.key.toLowerCase()).not.toContain("blog");
        expect(event.label.toLowerCase()).not.toContain("newsletter");
      }
    }
  });
});

describe("frequency promise", () => {
  it("is a real number shown at opt-in", () => {
    expect(Number.isInteger(NEWSLETTER_MAX_PER_MONTH)).toBe(true);
    expect(NEWSLETTER_MAX_PER_MONTH).toBeGreaterThan(0);
  });

  it("has a consent version to bump if the promise changes", () => {
    expect(NEWSLETTER_VERSION).toMatch(/^newsletter-v\d+\.\d+$/);
  });
});
