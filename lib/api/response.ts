import { NextResponse } from "next/server";
import type { ErrorCode } from "@/lib/api/errors";

// TRD 4.1.1 — every API route in the app must return this envelope shape.

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: { timestamp: string };
};

export type ApiError = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    field: string | null;
  };
};

export function ok<T>(data: T, init?: number) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
  return NextResponse.json(body, { status: init ?? 200 });
}

export function fail(
  code: ErrorCode,
  message: string,
  status: number,
  field: string | null = null
) {
  const body: ApiError = { success: false, error: { code, message, field } };
  return NextResponse.json(body, { status });
}
