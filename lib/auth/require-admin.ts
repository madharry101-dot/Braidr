import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * profiles.role includes 'admin', but nothing self-registers as one —
 * registerSchema (lib/validations/auth.ts) only allows client/braider/expert
 * on purpose. An admin account is created by directly setting a profile's
 * role via the service-role client; there's no in-app flow for it (and
 * shouldn't be one).
 */
export async function isAdmin(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}
