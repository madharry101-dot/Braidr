import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateNotificationsSchema } from "@/lib/validations/settings";
import { notificationEventsFor } from "@/lib/settings/notifications";
import { ok, fail } from "@/lib/api/response";

// GET /api/settings/notifications — TRD v2.0 §4.4. The role's event list
// plus the caller's current preferences (absent key = enabled).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, notification_preferences")
    .eq("id", user.id)
    .single();
  if (!profile) return fail("NOT_FOUND", "Profile not found.", 404);

  return ok({
    events: notificationEventsFor(profile.role),
    preferences: profile.notification_preferences ?? {},
  });
}

// PUT /api/settings/notifications — merge a partial preference map.
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateNotificationsSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  const merged = { ...(profile?.notification_preferences ?? {}), ...parsed.data.preferences };
  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: merged })
    .eq("id", user.id);
  if (error) return fail("INTERNAL_ERROR", "Could not save your preferences.", 500);

  return ok({ preferences: merged });
}
