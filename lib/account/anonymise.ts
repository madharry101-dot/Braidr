import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scrub a user's personal data and disable their login. Used by both the
 * admin delete route and self-service account deletion (GDPR-08).
 *
 * Financial/booking rows that reference this user are deliberately left
 * intact and legible — HMRC requires 7 years' retention (Privacy Policy §7)
 * — but every personally identifying field is cleared.
 */
export async function anonymiseAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  opts: { markDeleted?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (authError) return { ok: false, error: `disable login: ${authError.message}` };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: "Deleted User",
      display_name: null,
      avatar_url: null,
      phone: null,
      date_of_birth: null,
      hair_type: null,
      is_suspended: true,
      ...(opts.markDeleted ? { deleted_at: new Date().toISOString() } : {}),
    })
    .eq("id", userId);
  if (profileError) return { ok: false, error: "anonymise profile" };

  return { ok: true };
}

/**
 * True if the user has booking/financial history that must be retained
 * (so hard deletion is not permitted — anonymise instead).
 */
export async function hasProtectedHistory(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<boolean> {
  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const [{ count: asClient }, { count: asBraider }] = await Promise.all([
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("client_id", userId),
    braiderProfile
      ? admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("braider_id", braiderProfile.id)
      : Promise.resolve({ count: 0 }),
  ]);

  return (asClient ?? 0) > 0 || (asBraider ?? 0) > 0;
}
