import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { registerSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";

// POST /api/auth/register — TRD 4.2. No auth required.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimit = await checkRateLimit("auth", ip);
  if (!rateLimit.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const parsed = validate(registerSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { email, password, full_name, role } = parsed.data;

  const supabase = await createClient();

  // role/full_name flow into raw_user_meta_data, read by the
  // handle_new_user() trigger to populate public.profiles (FR-AUTH-01.4).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name } },
  });

  if (error) {
    return fail("VALIDATION_ERROR", error.message, 422, "email");
  }

  return ok({ user_id: data.user?.id, email_confirmation_required: !data.session }, 201);
}
