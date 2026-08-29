"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type ReferralInfo = {
  code: string;
  link: string;
  rewards: "coming_soon";
};

export function useReferral() {
  return useQuery({
    queryKey: ["referral", "me"],
    queryFn: () => api.get<ReferralInfo>("/referrals/me"),
    staleTime: 5 * 60 * 1000,
  });
}
