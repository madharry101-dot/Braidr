import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// DELETE /api/admin/users/:id — TRD 4.8 / PRD FR-ADMIN-01.1 ("delete any
// user account").
//
// ENGINEERING NOTE (real constraint, not a stylistic choice): bookings,
// income_records, and reviews all reference profiles/braider_profiles with
// no ON DELETE CASCADE (deliberately — see the bookings migration), and
// PRD 7.3 requires booking records to be retained 7 years for HMRC. So a
// literal hard delete of a user with any booking history would either fail
// outright (FK violation) or, if it somehow succeeded, would destroy
// financial records Braidr is legally required to keep. This route
// reflects that: a user with no booking/income history is genuinely
// deleted (auth.users cascades to profiles); a user WITH history is
// anonymised instead — personal fields scrubbed, login disabled — while
// the booking/financial rows they're attached to stay intact and legible
// for tax/audit purposes. "Delete" in the PRD's FR-ADMIN-01.1 sense means
// "this person and their personal data are gone", not "every row that
// mentions them is gone" — those aren't the same thing once financial
// retention law is in the picture.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  if (params.id === user.id) {
    return fail("VALIDATION_ERROR", "You can't delete your own account.", 422);
  }

  const admin = createAdminClient();

  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    .select("id")
    .eq("user_id", params.id)
    .single();

  const [{ count: asClient }, { count: asBraider }] = await Promise.all([
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("client_id", params.id),
    braiderProfile
      ? admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("braider_id", braiderProfile.id)
      : Promise.resolve({ count: 0 }),
  ]);

  const hasProtectedHistory = (asClient ?? 0) > 0 || (asBraider ?? 0) > 0;

  if (!hasProtectedHistory) {
    const { error } = await admin.auth.admin.deleteUser(params.id);
    if (error) return fail("INTERNAL_ERROR", `Failed to delete user: ${error.message}`, 500);
    return ok({ mode: "deleted" });
  }

  // Anonymise rather than delete: scrub personal fields, disable login via
  // both a random password (in case they still remember the old one) and
  // is_suspended (belt-and-braces, and consistent with how suspension is
  // already enforced at login/middleware).
  const { error: authError } = await admin.auth.admin.updateUserById(params.id, {
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (authError)
    return fail("INTERNAL_ERROR", `Failed to disable login: ${authError.message}`, 500);

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: "Deleted User",
      display_name: null,
      avatar_url: null,
      phone: null,
      is_suspended: true,
    })
    .eq("id", params.id);
  if (profileError) return fail("INTERNAL_ERROR", "Failed to anonymise profile.", 500);

  return ok({
    mode: "anonymised",
    reason:
      "This user has booking or financial history that must be retained (HMRC 7-year requirement).",
  });
}
