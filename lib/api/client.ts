import type { ErrorCode } from "@/lib/api/errors";

// Client-side counterpart to lib/api/response.ts. Every route returns the
// TRD 4.1.1 envelope; this unwraps it and throws a typed error the UI can
// branch on (field -> attach to a form input, code -> special-case).

export type ApiEnvelope<T> =
  | { success: true; data: T; meta: { timestamp: string } }
  | { success: false; error: { code: ErrorCode; message: string; field: string | null } };

export class ApiError extends Error {
  code: ErrorCode;
  field: string | null;
  status: number;

  constructor(code: ErrorCode, message: string, field: string | null, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(path.startsWith("http") ? path : `/api${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      "INTERNAL_ERROR",
      "The server returned an unexpected response.",
      null,
      res.status
    );
  }

  if (!payload || payload.success === false) {
    const err = payload?.error;
    throw new ApiError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Something went wrong. Please try again.",
      err?.field ?? null,
      res.status
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  del: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
