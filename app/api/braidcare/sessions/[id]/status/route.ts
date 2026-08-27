import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/sessions/:id/status — TRD 4.5 / 7.3. Lightweight poll
// target for React Query (refetchInterval: 3s while status === "in_progress",
// per TRD's caching strategy table).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: session } = await supabase
    .from("braidcare_sessions")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (!session) return fail("NOT_FOUND", "Session not found.", 404);
  return ok({ status: session.status });
}
