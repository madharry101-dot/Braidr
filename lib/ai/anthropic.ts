import Anthropic from "@anthropic-ai/sdk";

// Server-only. TRD 5.1 constraint: ANTHROPIC_API_KEY is never exposed to
// the client — never import this from a Client Component.
//
// Lazily instantiated: a top-level `new Anthropic(...)` ran on every import
// of this module (including transitively, e.g. importing braidcare.ts just
// for the pure computeReferralSuggested() helper), which construction does
// non-trivial credential-resolution work under the hood — surfaced as a
// "Jest environment torn down" warning from unit tests that never actually
// call the API. Deferring construction until first real use avoids that.
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}
