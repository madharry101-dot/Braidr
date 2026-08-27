import type { ZodType, ZodError } from "zod";
import { fail } from "@/lib/api/response";

/**
 * Parses `input` against `schema`. Returns { data } on success, or an
 * already-built 422 NextResponse (TRD 4.1.1 error envelope) on failure —
 * callers just return it directly:
 *
 *   const parsed = validate(schema, await request.json());
 *   if (!parsed.ok) return parsed.response;
 *   const { data } = parsed;
 */
export function validate<T>(schema: ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true as const, data: result.data };
  }
  return { ok: false as const, response: validationErrorResponse(result.error) };
}

function validationErrorResponse(error: ZodError) {
  const first = error.issues[0];
  return fail(
    "VALIDATION_ERROR",
    first?.message ?? "Invalid request body.",
    422,
    first?.path?.join(".") ?? null
  );
}
