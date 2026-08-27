import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { createReferralSchema } from "@/lib/validations/expert";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// POST /api/experts/referrals — TRD 4.7 / PRD FR-EXP-01.3-01.4. Records
// the "Speak to a specialist" click-through from a BraidCare report.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(createReferralSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { expert_id, braidcare_session_id, consent_given } = parsed.data;

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("id")
    .eq("id", expert_id)
    .eq("is_verified", true)
    .eq("is_active", true)
    .single();
  if (!expert) return fail("NOT_FOUND", "Expert not found or not currently listed.", 404);

  // Requiring the referral to trace back to a session that actually
  // flagged a concern — FR-EXP-01.3 frames this whole flow as originating
  // "from BraidCare report", not as a general-purpose contact-an-expert
  // button. Also confirms ownership: the session must be this client's own.
  if (braidcare_session_id) {
    const { data: session } = await supabase
      .from("braidcare_sessions")
      .select("id, client_id, referral_suggested")
      .eq("id", braidcare_session_id)
      .eq("client_id", user.id)
      .single();
    if (!session) return fail("NOT_FOUND", "BraidCare session not found.", 404);
    if (!session.referral_suggested) {
      return fail(
        "VALIDATION_ERROR",
        "This session didn't flag a referral.",
        422,
        "braidcare_session_id"
      );
    }
  }

  const { data: referral, error } = await supabase
    .from("expert_referrals")
    .insert({ expert_id, client_id: user.id, braidcare_session_id, consent_given })
    .select("id")
    .single();
  if (error || !referral) return fail("INTERNAL_ERROR", "Failed to record referral.", 500);

  const admin = createAdminClient();
  await admin.rpc("increment_expert_referral_count", { p_expert_id: expert_id });

  return ok({ referral_id: referral.id }, 201);
}

// GET /api/experts/referrals — TRD 4.7: "List referrals for admin
// reporting" (admin). Extended here to also let an expert see their own
// referrals — otherwise nothing in this sprint lets an expert view the
// clients referred to them at all, which defeats the point of building
// consent-gated flag access (20260830000001 migration) if there's no way
// to reach it from this endpoint.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  if (await isAdmin(supabase, user.id)) {
    const admin = createAdminClient();
    const { data: referrals, error } = await admin
      .from("expert_referrals")
      .select(
        "id, expert_id, client_id, braidcare_session_id, consent_given, status, referral_fee_pence, completed_at, created_at"
      )
      .order("created_at", { ascending: false });
    if (error) return fail("INTERNAL_ERROR", "Failed to load referrals.", 500);

    // Hydrate the expert name so the admin table is legible.
    const rows = referrals ?? [];
    const { data: experts } = await admin
      .from("expert_profiles")
      .select("id, user_id, credentials")
      .in("id", [...new Set(rows.map((r) => r.expert_id))]);
    const { data: people } = await admin
      .from("profiles")
      .select("id, display_name, full_name")
      .in(
        "id",
        (experts ?? []).map((e) => e.user_id)
      );
    const nameByUser = new Map((people ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));
    const expertMeta = new Map(
      (experts ?? []).map((e) => [e.id, { name: nameByUser.get(e.user_id) ?? e.credentials }])
    );

    return ok({
      referrals: rows.map((r) => ({
        ...r,
        expert_name: expertMeta.get(r.expert_id)?.name ?? "Expert",
      })),
    });
  }

  const { data: expertProfile } = await supabase
    .from("expert_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!expertProfile) return fail("FORBIDDEN", "Only experts or admins can list referrals.", 403);

  const { data: referrals, error } = await supabase
    .from("expert_referrals")
    .select("id, client_id, braidcare_session_id, consent_given, status, created_at")
    .eq("expert_id", expertProfile.id)
    .order("created_at", { ascending: false });
  if (error) return fail("INTERNAL_ERROR", "Failed to load referrals.", 500);
  return ok({ referrals });
}
