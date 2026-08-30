// Verifies the database-level guarantees added by the hair-type, blog and
// newsletter work (migrations 20260908000001 .. 20260910000001).
//
// Deliberately exercises the CONSTRAINTS AND TRIGGERS rather than the API:
// most of these were claimed to hold "even for the service role", and the
// only way to show that is to attack them with the service-role client and
// watch the database refuse.
//
//   node scripts/smoke-test-hairtype-blog-newsletter.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

globalThis.WebSocket ??= WebSocket;

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log("  OK  —", msg);
  else {
    console.error("  FAIL —", msg);
    failures++;
  }
};
/** Asserts the database REFUSED an operation. */
const refused = (error, msg) => ok(Boolean(error), msg + (error ? "" : "  <-- IT WAS ALLOWED"));

const suffix = Date.now();
const PW = "correct-horse-battery-staple";
const ids = {
  authorId: null,
  reviewerId: null,
  braiderUserId: null,
  braiderProfileId: null,
  clientId: null,
  postId: null,
};

async function mkUser(role, label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `hbn-${label}-${suffix}@braidr.internal.test`,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `HBN ${label}` },
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  return data.user.id;
}

try {
  ids.authorId = await mkUser("expert", "author");
  ids.reviewerId = await mkUser("admin", "reviewer");
  ids.braiderUserId = await mkUser("braider", "braider");
  ids.clientId = await mkUser("client", "client");
  console.log("Created 4 test accounts.\n");

  // ── 1. Hair type ──────────────────────────────────────────────────────
  console.log("1. Hair type vocabulary and provenance");

  const { error: badType } = await admin
    .from("profiles")
    .update({ hair_type: "Type 4" })
    .eq("id", ids.clientId);
  refused(badType, "the legacy 'Type 4' value is rejected by the CHECK constraint");

  const { error: goodType } = await admin
    .from("profiles")
    .update({ hair_type: "coily" })
    .eq("id", ids.clientId);
  ok(!goodType, "'coily' is accepted");

  const { data: legacy } = await admin
    .from("profiles")
    .select("id")
    .not("hair_type", "is", null)
    .not("hair_type", "in", '("straight","wavy","curly","coily","prefer_not_to_say")');
  ok((legacy ?? []).length === 0, "no pre-existing profile is left on an unmapped hair_type");

  // The guard only applies to non-service callers, so this needs a real session.
  const asClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginErr } = await asClient.auth.signInWithPassword({
    email: `hbn-client-${suffix}@braidr.internal.test`,
    password: PW,
  });
  ok(!loginErr, "client can sign in");

  const { error: selfPromote } = await asClient
    .from("profiles")
    .update({ hair_type_source: "braider_confirmed", hair_type_confirmed_by: ids.clientId })
    .eq("id", ids.clientId);
  refused(selfPromote, "a client CANNOT mark their own hair type braider-confirmed");

  const { error: selfEdit } = await asClient
    .from("profiles")
    .update({ hair_type: "curly" })
    .eq("id", ids.clientId);
  ok(!selfEdit, "a client CAN still edit their own hair type");

  const { error: platformConfirm } = await admin
    .from("profiles")
    .update({
      hair_type: "coily",
      hair_type_source: "braider_confirmed",
      hair_type_confirmed_by: ids.braiderUserId,
      hair_type_confirmed_at: new Date().toISOString(),
    })
    .eq("id", ids.clientId);
  ok(!platformConfirm, "the platform (service role) CAN record a braider confirmation");

  // ── 2. Texture verification is derived, not declared ──────────────────
  console.log("\n2. Braider texture specialisations");

  const { data: bp } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "London" })
    .select("id")
    .single();
  ids.braiderProfileId = bp.id;

  await admin
    .from("braider_texture_specialisations")
    .insert({ braider_id: bp.id, texture: "coily" });
  const unverified = await admin
    .from("braider_texture_specialisations")
    .select("is_verified")
    .eq("braider_id", bp.id)
    .single();
  ok(unverified.data.is_verified === false, "a new specialisation starts UNVERIFIED");

  const asBraider = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await asBraider.auth.signInWithPassword({
    email: `hbn-braider-${suffix}@braidr.internal.test`,
    password: PW,
  });
  const { error: selfVerify } = await asBraider
    .from("braider_texture_specialisations")
    .update({ is_verified: true })
    .eq("braider_id", bp.id);
  const stillUnverified = await admin
    .from("braider_texture_specialisations")
    .select("is_verified")
    .eq("braider_id", bp.id)
    .single();
  ok(
    Boolean(selfVerify) || stillUnverified.data.is_verified === false,
    "a braider CANNOT self-award the verified badge"
  );

  const { data: photo } = await admin
    .from("braider_portfolio_photos")
    .insert({ braider_id: bp.id, storage_path: `${ids.braiderUserId}/x.jpg`, texture: "coily" })
    .select("id")
    .single();
  const afterTag = await admin
    .from("braider_texture_specialisations")
    .select("is_verified, verified_at")
    .eq("braider_id", bp.id)
    .single();
  ok(afterTag.data.is_verified === true, "tagging a portfolio photo VERIFIES the specialisation");
  ok(afterTag.data.verified_at !== null, "verified_at is stamped by the trigger");

  await admin.from("braider_portfolio_photos").delete().eq("id", photo.id);
  const afterRemove = await admin
    .from("braider_texture_specialisations")
    .select("is_verified")
    .eq("braider_id", bp.id)
    .single();
  ok(afterRemove.data.is_verified === false, "removing the last tagged photo UNVERIFIES it again");

  // ── 3. The blog review gate ───────────────────────────────────────────
  console.log("\n3. Blog review gate (attacked with the SERVICE ROLE)");

  const base = {
    title: "Looking after braids in winter",
    body: "## Heading\n\nSome text.",
    excerpt: "A short teaser.",
    author_id: ids.authorId,
    category: "health_safety",
  };

  const { error: bornPublished } = await admin
    .from("blog_posts")
    .insert({ ...base, slug: `hbn-a-${suffix}`, status: "published" });
  refused(bornPublished, "a post CANNOT be created already published");

  const { data: post, error: draftErr } = await admin
    .from("blog_posts")
    .insert({ ...base, slug: `hbn-b-${suffix}` })
    .select("id, status")
    .single();
  ok(!draftErr && post.status === "draft", "a post is created as a draft");
  ids.postId = post.id;

  const { error: skipReview } = await admin
    .from("blog_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      reviewed_by: ids.reviewerId,
    })
    .eq("id", post.id);
  refused(skipReview, "draft -> published is REFUSED (must pass through review)");

  const { error: toReview } = await admin
    .from("blog_posts")
    .update({ status: "in_review" })
    .eq("id", post.id);
  ok(!toReview, "draft -> in_review is allowed");

  const { error: selfReview } = await admin
    .from("blog_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      reviewed_by: ids.authorId, // the author reviewing their own work
    })
    .eq("id", post.id);
  refused(selfReview, "an author CANNOT be their own reviewer");

  const { error: noReviewer } = await admin
    .from("blog_posts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", post.id);
  refused(noReviewer, "publishing with NO reviewer recorded is refused");

  const { error: realReview } = await admin
    .from("blog_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      reviewed_by: ids.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", post.id);
  ok(!realReview, "in_review -> published by a DIFFERENT person succeeds");

  const { data: anonRead } = await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    .from("blog_posts")
    .select("id, title")
    .eq("id", post.id);
  ok((anonRead ?? []).length === 1, "a published post is readable WITHOUT an account");

  const { data: anonDraft } = await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    .from("blog_posts")
    .select("id")
    .eq("status", "draft");
  ok((anonDraft ?? []).length === 0, "drafts are NOT readable without an account");

  // ── 4. Newsletter consent ─────────────────────────────────────────────
  console.log("\n4. Newsletter consent and send queue");

  const { error: newsletterConsent } = await admin.from("consent_events").insert({
    user_id: ids.clientId,
    consent_type: "newsletter",
    consent_version: "newsletter-v1.0",
    granted: true,
  });
  ok(!newsletterConsent, "consent_events accepts the new 'newsletter' type");

  const { data: sub } = await admin
    .from("newsletter_subscriptions")
    .insert({ user_id: ids.clientId, consent_source: "settings_page" })
    .select("unsubscribe_token, subscribed_at, unsubscribed_at")
    .single();
  ok(/^[0-9a-f]{48}$/.test(sub.unsubscribe_token), "an unsubscribe token is generated (48 hex)");
  ok(sub.unsubscribed_at === null, "a new subscription is active");

  const { error: badSource } = await admin
    .from("newsletter_subscriptions")
    .update({ consent_source: "imported_list" })
    .eq("user_id", ids.clientId);
  refused(badSource, "an unrecognised consent_source is rejected");

  const { error: dupe } = await admin
    .from("newsletter_subscriptions")
    .insert({ user_id: ids.clientId, consent_source: "settings_page" });
  refused(dupe, "a user cannot have two subscription rows");

  await admin
    .from("newsletter_sends")
    .insert({ post_id: post.id, recipient_user_id: ids.clientId });
  const { error: doubleSend } = await admin
    .from("newsletter_sends")
    .insert({ post_id: post.id, recipient_user_id: ids.clientId });
  refused(doubleSend, "the same person cannot be queued twice for one post (no double-send)");

  const { count } = await admin
    .from("newsletter_sends")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id);
  ok(count === 1, "exactly one queued send exists for that post");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED.`);
} finally {
  if (ids.postId) await admin.from("blog_posts").delete().eq("id", ids.postId);
  if (ids.braiderProfileId)
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  for (const id of [ids.authorId, ids.reviewerId, ids.braiderUserId, ids.clientId]) {
    if (id) await admin.auth.admin.deleteUser(id);
  }
  console.log("(cleaned up)");
}

process.exit(failures === 0 ? 0 : 1);
