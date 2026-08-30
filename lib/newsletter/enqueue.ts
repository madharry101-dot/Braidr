import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Queues a newsletter send for every currently-subscribed user when a post
 * is published.
 *
 * Queued, not sent inline: publishing must stay instant and must not fail
 * because an email provider is having a bad minute. The cron
 * (/api/cron/newsletter) drains the queue.
 *
 * Idempotent — newsletter_sends has a unique (post_id, recipient_user_id),
 * so re-running this for the same post cannot produce a second email to
 * anyone who already has one. That matters because a post can be
 * unpublished and republished.
 *
 * Best-effort by design: a queueing failure must not roll back a publish
 * the reviewer has already approved. It's logged loudly instead.
 */
export async function enqueueNewsletterForPost(
  admin: ReturnType<typeof createAdminClient>,
  postId: string
): Promise<{ queued: number }> {
  const { data: subscribers, error } = await admin
    .from("newsletter_subscriptions")
    .select("user_id")
    .is("unsubscribed_at", null);

  if (error) {
    console.error("[newsletter] couldn't load subscribers to queue", error);
    return { queued: 0 };
  }
  if (!subscribers || subscribers.length === 0) return { queued: 0 };

  const { error: insertError } = await admin.from("newsletter_sends").upsert(
    subscribers.map((s) => ({ post_id: postId, recipient_user_id: s.user_id })),
    { onConflict: "post_id,recipient_user_id", ignoreDuplicates: true }
  );

  if (insertError) {
    console.error("[newsletter] couldn't queue sends", insertError);
    return { queued: 0 };
  }
  return { queued: subscribers.length };
}
