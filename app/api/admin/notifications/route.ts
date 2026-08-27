import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { announcementSchema } from "@/lib/validations/moderation";
import { resolveSegmentRecipients } from "@/lib/admin/segment-recipients";
import { sendEmail } from "@/lib/email/send";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

const SEND_CONCURRENCY = 10;

// POST /api/admin/notifications — TRD/PRD FR-ADMIN-01.7. An empty segment
// object ({}) matches everyone — that's the "platform-wide" case; any
// combination of fields narrows it to a "targeted" segment.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const parsed = validate(announcementSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { segment, subject, message } = parsed.data;

  const admin = createAdminClient();
  const recipients = await resolveSegmentRecipients(admin, segment);

  if (recipients.length === 0) {
    return fail("VALIDATION_ERROR", "No users match this segment.", 422, "segment");
  }

  // Bounded concurrency rather than fully sequential (slow) or fully
  // parallel (risks tripping Resend's rate limits) — same reasoning as the
  // platform-scale note on resolveSegmentRecipients.
  for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
    const chunk = recipients.slice(i, i + SEND_CONCURRENCY);
    await Promise.all(chunk.map((r) => sendEmail({ to: r.email, subject, text: message })));
  }

  const { data: announcement, error } = await admin
    .from("platform_announcements")
    .insert({ admin_id: user.id, segment, subject, message, recipient_count: recipients.length })
    .select("id")
    .single();
  if (error || !announcement)
    return fail("INTERNAL_ERROR", "Sent, but failed to log the announcement.", 500);

  return ok({ announcement_id: announcement.id, recipient_count: recipients.length }, 201);
}

// GET /api/admin/notifications — history of past announcements.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const admin = createAdminClient();
  const { data: announcements, error } = await admin
    .from("platform_announcements")
    .select("id, segment, subject, message, recipient_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail("INTERNAL_ERROR", "Failed to load announcements.", 500);
  return ok({ announcements: announcements ?? [] });
}
