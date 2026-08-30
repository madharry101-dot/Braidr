import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Author/reviewer name + advisor credential hydration. Kept here because
// three routes need the same joins and postgrest-js can't type embedded
// selects in this schema (empty Relationships — see types/database.ts).

export type PersonInfo = { name: string; credentials: string | null };

export async function hydratePeople(
  supabase: SupabaseClient<Database>,
  userIds: string[]
): Promise<Map<string, PersonInfo>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const [{ data: profiles }, { data: experts }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, full_name").in("id", ids),
    // Dermatologist advisors get a credential byline. Only verified
    // advisors' credentials are shown — an unverified claim is not a byline.
    supabase
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
