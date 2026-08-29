import type { createAdminClient } from "@/lib/supabase/admin";
import { hasProtectedHistory } from "@/lib/account/anonymise";

// GDPR-08 — 30 days after a user requests deletion, hard-delete accounts
// that have no financial history to retain. Accounts WITH booking history
// stay anonymised forever (already scrubbed at request time; HMRC 7-year
// retention on the financial rows they're attached to).
const GRACE_DAYS = 30;

export async function runAccountDeletion(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await admin.from("profiles").select("id").lt("deleted_at", cutoff);
  if (error) throw new Error(`account-deletion query failed: ${error.message}`);

  let hardDeleted = 0;
  let retainedAnonymised = 0;

  for (const profile of due ?? []) {
    if (await hasProtectedHistory(admin, profile.id)) {
      retainedAnonymised += 1;
      continue; // already anonymised; nothing more we're permitted to do
    }
    const { error: delError } = await admin.auth.admin.deleteUser(profile.id);
    if (delError) {
      console.error(`[account-deletion] deleteUser failed for ${profile.id}`, delError);
      continue;
    }
    hardDeleted += 1;
  }

  return {
    grace_days: GRACE_DAYS,
    hard_deleted: hardDeleted,
    retained_anonymised: retainedAnonymised,
  };
}
