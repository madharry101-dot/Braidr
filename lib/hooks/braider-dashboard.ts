"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { BraiderMe } from "@/lib/types/braidmatch";
import type { ServiceCategory } from "@/types/database";
import type { CreateBraiderProfileInput } from "@/lib/validations/braider";

const KEY = ["braider", "me"];

export function useBraiderMe() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<BraiderMe>("/braiders/me"),
  });
}

function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateBraiderProfile() {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (input: CreateBraiderProfileInput) =>
      api.post<{ id: string }>("/braiders/me", input),
    onSuccess: invalidate,
  });
}

export function useUpdateBraiderProfile(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (input: {
      bio?: string;
      area?: string;
      city?: string;
      specialisations?: string[];
      years_experience?: number;
    }) => api.put<{ updated: boolean }>(`/braiders/${braiderId}/profile`, input),
    onSuccess: invalidate,
  });
}

export type ServiceInput = {
  name: string;
  category: ServiceCategory;
  price_from: number;
  price_to?: number;
  duration_mins: number;
  description?: string;
};

export function useCreateService(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      api.post<{ service_id: string }>(`/braiders/${braiderId}/services`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateService(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: ({ sid, ...input }: ServiceInput & { sid: string }) =>
      api.put<{ updated: boolean }>(`/braiders/${braiderId}/services/${sid}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteService(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (sid: string) =>
      api.del<{ deactivated: boolean }>(`/braiders/${braiderId}/services/${sid}`),
    onSuccess: invalidate,
  });
}

export function useSetAvailabilityRules(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (rules: { day_of_week: number; start_time: string; end_time: string }[]) =>
      api.put<{ updated: boolean }>(`/braiders/${braiderId}/availability-rules`, { rules }),
    onSuccess: invalidate,
  });
}

export function useBlockDate(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (input: { date: string; reason?: string }) =>
      api.post<{ blocked: boolean }>(`/braiders/${braiderId}/blocked-dates`, input),
    onSuccess: invalidate,
  });
}

export function useUnblockDate(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (date: string) =>
      api.del<{ unblocked: boolean }>(`/braiders/${braiderId}/blocked-dates?date=${date}`),
    onSuccess: invalidate,
  });
}

export function useDeletePortfolioPhoto(braiderId: string) {
  const invalidate = useInvalidateMe();
  return useMutation({
    mutationFn: (index: number) =>
      api.del<{ portfolio_photos: string[] }>(`/braiders/${braiderId}/portfolio-photos/${index}`),
    onSuccess: invalidate,
  });
}

export function useStartStripeOnboarding(braiderId: string) {
  return useMutation({
    mutationFn: () => api.post<{ onboarding_url: string }>(`/braiders/${braiderId}/stripe/onboard`),
  });
}
