import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

// Drains the newsletter_sends queue. One email per (post, recipient), with
// the post title, its excerpt as the teaser, a "Continue reading" link, and
// the login-free unsubscribe link PECR reg. 23 requires.
//
// Batched and retryable: a provider outage leaves rows queued for the next
// run rather than silently dropping subscribers. attempts is capped so a
// permanently-bad address stops being retried forever.

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;

export async function sendQueuedNewsletters(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://braidr.netlify.app";

  const { data: queue, error } = await admin
    .from("newsletter_sends")
    .select("id, post_id, recipient_user_id, attempts")
    .eq("status", "queued")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[cron/newsletter] couldn't read the queue", error);
    return { processed: 0, sent: 0, failed: 0 };
  }
  if (!queue || queue.length === 0) return { processed: 0, sent: 0, failed: 0 };

  // Bulk-load the posts and the recipients' subscription state so the loop
  // below doesn't run four queries per email.
  const postIds = [...new Set(queue.map((q) => q.post_id))];
  const userIds = [...new Set(queue.map((q) => q.recipient_user_id))];

  const [{ data: posts }, { data: subs }] = await Promise.all([
    admin.from("blog_posts").select("id, title, slug, excerpt, status").in("id", postIds),
    admin
      .from("newsletter_subscriptions")
      .select("user_id, unsubscribed_at, unsubscribe_token")
      .in("user_id", userIds),
  ]);

  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

  let sent = 0;
  let failed = 0;

  for (const row of queue) {
    const post = postById.get(row.post_id);
    const sub = subByUser.get(row.recipient_user_id);

    // Someone who unsubscribed between queueing and sending must not get
    // this. Checked at send time, not only at queue time — that gap is
    // exactly where an unlawful send would happen.
    if (!post || post.status !== "published" || !sub || sub.unsubscribed_at !== null) {
      await admin
        .from("newsletter_sends")
        .update({
          status: "failed",
          attempts: row.attempts + 1,
          last_error: !post
            ? "post missing"
            : post.status !== "published"
              ? "post no longer published"
              : "recipient unsubscribed before send",
        })
        .eq("id", row.id);
      failed++;
      continue;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(row.recipient_user_id);
    const email = authUser?.user?.email;
    if (!email) {
      await admin
        .from("newsletter_sends")
        .update({ status: "failed", attempts: row.attempts + 1, last_error: "no email address" })
        .eq("id", row.id);
      failed++;
      continue;
    }

    const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;
    try {
      await sendEmail({
        to: email,
        subject: post.title,
        text: [
          post.title,
          "",
          post.excerpt,
          "",
          `Continue reading: ${siteUrl}/blog/${post.slug}`,
          "",
          "—",
          "You're getting this because you opted in to Braidr's educational emails.",
          `Unsubscribe: ${unsubscribeUrl}`,
        ].join("\n"),
      });
      await admin
        .from("newsletter_sends")
        .update({ status: "sent", attempts: row.attempts + 1, sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      // Stays 'queued' until MAX_ATTEMPTS so the next run retries it.
      await admin
        .from("newsletter_sends")
        .update({
          status: row.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued",
          attempts: row.attempts + 1,
          last_error: message.slice(0, 500),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return { processed: queue.length, sent, failed };
}
