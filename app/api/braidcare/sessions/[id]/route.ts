import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/sessions/:id — TRD 4.5. Owner (client or the booking's
// braider) only, enforced by RLS — never selects photo_paths/ai_raw_response
// (column grant on braidcare_sessions blocks it for both roles anyway).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: session } = await supabase
    .from("braidcare_sessions")
    .select(
      "id, booking_id, session_number, session_type, status, photos_count, overall_status, summary, condition_flags, recommendations, referral_suggested, referral_threshold_met, report_delivered_at, created_at"
    )
    .eq("id", params.id)
    .single();

  if (!session) return fail("NOT_FOUND", "Session not found.", 404);
  return ok({ session });
}
