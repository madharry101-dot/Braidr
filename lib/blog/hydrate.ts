import { createAdminClient } from "@/lib/supabase/admin";

// Author/reviewer byline hydration.
//
// Uses the service-role client deliberately, and selects only the two
// fields a byline needs.
//
// The alternative — an RLS policy letting anyone read the profile of
// anyone who has published a post — would work, but `profiles` rows carry
// phone, date_of_birth, hair_type, stripe_customer_id and referral_code,
// and RLS grants a row, not a column list. Publishing an article should
// expose a name and a credential, not a phone number. Reading server-side
// and returning two fields keeps the byline public without widening what
// "public" means for the rest of the row.
//
// Server-only (every caller is a Route Handler or a server component).

export type PersonInfo = { name: string; credentials: string | null };

export async function hydratePeople(userIds: string[]): Promise<Map<string, PersonInfo>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const admin = createAdminClient();
  const [{ data: profiles }, { data: experts }] = await Promise.all([
    admin.from("profiles").select("id, display_name, full_name").in("id", ids),
    // Dermatologist advisors get a credential byline. Only verified
    // advisors' credentials are shown — an unverified claim is not a byline.
    admin
      .from("expert_profiles")
      .select("user_id, credentials")
      .in("user_id", ids)
      .eq("is_verified", true),
  ]);

  const credentialsByUser = new Map(
    (experts ?? []).map((e) => [e.user_id, e.credentials] as const)
  );

  return new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        name: p.display_name ?? p.full_name,
        credentials: credentialsByUser.get(p.id) ?? null,
      },
    ])
  );
}
