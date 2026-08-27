"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import type { Role } from "@/types/database";

export type SessionUser = {
  user: { id: string; email: string | undefined };
  profile: {
    id: string;
    role: Role;
    full_name: string;
    display_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
};

// GET /api/auth/session — 401 when signed out. We treat that as a normal
// "no session" state (data: null), not a query error.
export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api.get<SessionUser>("/auth/session");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export const DASHBOARD_PATH: Record<Role, string> = {
  client: "/dashboard/client",
  braider: "/dashboard/braider",
  expert: "/dashboard/expert",
  admin: "/admin",
};
