// Version identifiers stored on every consent_events row (TRD v2.0 §3.5 —
// "the version of the wording they saw"). Bump these whenever the Terms,
// Privacy Policy, or a consent screen's wording materially changes, so the
// consent log records which text each user actually agreed to.
//
// The legal pages are drafts pending solicitor review; these are v1.0 of
// the drafted text.
export const TERMS_VERSION = "terms-v1.0";
export const PRIVACY_VERSION = "privacy-v1.0";

// Registration accepts Terms + Privacy together in one checkbox (GDPR-01),
// so the single consent_version field records both.
export const TERMS_AND_PRIVACY_VERSION = `${TERMS_VERSION}+${PRIVACY_VERSION}`;

export const MARKETING_VERSION = "marketing-v1.0";
export const COOKIES_VERSION = "cookies-v1.0";
export const BRAIDCARE_PHOTO_CONSENT_VERSION = "braidcare-photo-v1.0";
export const EXPERT_REFERRAL_SHARE_VERSION = "expert-referral-share-v1.0";
export const NEWSLETTER_VERSION = "newsletter-v1.0";
