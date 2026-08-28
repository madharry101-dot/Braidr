import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

// PRD v2.0 §4.11 — `/dashboard` is the canonical role-aware entry point.
// The per-role dashboards live at /dashboard/{client,braider,expert} (and
// /admin); this server component just routes the user to theirs. Mirrors
// DASHBOARD_PATH in lib/hooks/use-session.ts — keep the two in sync.
const DASHBOARD_PATH: Record<Role, string> = {
  client: "/dashboard/client",
  braider: "/dashboard/braider",
  expert: "/dashboard/expert",
  admin: "/admin",
};

export default async function DashboardIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(profile ? DASHBOARD_PATH[profile.role] : "/dashboard/client");
}
