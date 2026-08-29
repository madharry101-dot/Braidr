import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { anonymiseAccount } from "@/lib/account/anonymise";
import { ok, fail } from "@/lib/api/response";

const deleteSchema = z.object({
  confirm: z.string().refine((v) => v === "DELETE", 'Type "DELETE" to confirm.'),
});

// DELETE /api/settings/account — GDPR-08. Immediately anonymises the
// caller's personal data and disables login; a scheduled job hard-deletes
// the account 30 days later if it has no financial history to retain.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(deleteSchema, await request.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();

  // Braider with unpaid completed bookings: block until the payout clears
  // (Consent Library GDPR-08 body for braiders).
  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (braiderProfile) {
    const { count: unpaid } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("braider_id", braiderProfile.id)
      .eq("status", "completed")
      .is("stripe_transfer_id", null);
    if ((unpaid ?? 0) > 0) {
      return fail(
        "VALIDATION_ERROR",
        "You have a payout still to be settled. Please try again once it has cleared.",
        409
      );
    }
  }

  const result = await anonymiseAccount(admin, user.id, { markDeleted: true });
  if (!result.ok) {
    console.error("[settings/account] anonymise failed", result.error);
    return fail("INTERNAL_ERROR", "Could not delete your account. Please contact support.", 500);
  }

  await supabase.auth.signOut();
  return ok({ deleted: true });
}
