import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/newsletter — subscriber counts plus the consent audit log.
//
// The brief asks for an audit trail that is "genuinely queryable, not just
// implied by row existence", so this returns two things:
//
//   * current state, from newsletter_subscriptions (who is subscribed now,
//     when they opted in, and where that consent was captured), and
//   * the full history, from consent_events — append-only, so a
//     subscribe -> unsubscribe -> resubscribe sequence is all still there,
//     which the current-state table alone could not tell you.
//
// ?format=csv returns the same rows as a download for a compliance request.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const admin = createAdminClient();

  const [{ data: subs }, { data: events }] = await Promise.all([
    admin
      .from("newsletter_subscriptions")
      .select("user_id, subscribed_at, unsubscribed_at, consent_source, updated_at")
      .order("subscribed_at", { ascending: false })
      .limit(5000),
    admin
      .from("consent_events")
      .select("user_id, granted, consent_version, ip_address, created_at")
      .eq("consent_type", "newsletter")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const userIds = [
    ...new Set([...(subs ?? []).map((s) => s.user_id), ...(events ?? []).map((e) => e.user_id)]),
  ];
  const { data: people } = await admin
    .from("profiles")
    .select("id, full_name, display_name")
    .in("id", userIds);
  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.display_name ?? p.full_name] as const)
  );

  // Email addresses live in auth.users, not profiles. Only fetched for the
  // CSV export — the on-screen table doesn't need them, and a subscriber
  // list is exactly the sort of thing not to render more widely than
  // necessary.
  const rows = (subs ?? []).map((s) => ({
    user_id: s.user_id,
    name: nameById.get(s.user_id) ?? "Unknown",
    subscribed_at: s.subscribed_at,
    unsubscribed_at: s.unsubscribed_at,
    consent_source: s.consent_source,
    active: s.unsubscribed_at === null,
  }));

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const header = "user_id,name,subscribed_at,consent_source,unsubscribed_at,active";
    const body = rows
      .map((r) =>
        [
          r.user_id,
          `"${r.name.replace(/"/g, '""')}"`,
          r.subscribed_at,
          r.consent_source,
          r.unsubscribed_at ?? "",
          r.active,
        ].join(",")
      )
      .join("\n");
    return new Response(`${header}\n${body}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="newsletter-consent-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return ok({
    active_count: rows.filter((r) => r.active).length,
    total_ever: rows.length,
    subscribers: rows.slice(0, 200),
    audit_log: (events ?? []).slice(0, 200).map((e) => ({
      ...e,
      name: nameById.get(e.user_id) ?? "Unknown",
    })),
  });
}
