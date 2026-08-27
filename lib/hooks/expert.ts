"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiEnvelope } from "@/lib/api/client";
import type { BraidcareSessionDetail } from "@/lib/types/braidcare";
import type { ExpertCard, ExpertReferral, MyExpertProfile } from "@/lib/types/expert";

export function useExperts(specialisation?: string) {
  const qs = specialisation ? `?specialisation=${encodeURIComponent(specialisation)}` : "";
  return useQuery({
    queryKey: ["experts", specialisation ?? ""],
    queryFn: () => api.get<{ experts: ExpertCard[] }>(`/experts${qs}`),
    select: (d) => d.experts,
  });
}

export function useMyExpertProfile() {
  return useQuery({
    queryKey: ["expert", "me"],
    queryFn: () => api.get<{ expert: MyExpertProfile | null }>("/experts/me"),
    select: (d) => d.expert,
  });
}

export function useCreateExpertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FormData) => {
      const res = await fetch("/api/experts", { method: "POST", body: form });
      const payload = (await res.json()) as ApiEnvelope<{ expert_id: string }>;
      if (!payload.success) {
        const e = new Error(payload.error.message);
        (e as { field?: string | null }).field = payload.error.field;
        throw e;
      }
      return payload.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert", "me"] }),
  });
}

export function useExpertReferrals(enabled = true) {
  return useQuery({
    queryKey: ["expert", "referrals"],
    queryFn: () => api.get<{ referrals: ExpertReferral[] }>("/experts/referrals"),
    select: (d) => d.referrals,
    enabled,
  });
}

export function useReferralSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["braidcare", "session", sessionId],
    queryFn: () => api.get<{ session: BraidcareSessionDetail }>(`/braidcare/sessions/${sessionId}`),
    select: (d) => d.session,
    enabled: Boolean(sessionId),
  });
}

export function useCreateReferral() {
  return useMutation({
    mutationFn: (input: {
      expert_id: string;
      braidcare_session_id?: string;
      consent_given: boolean;
    }) => api.post<{ referral_id: string }>("/experts/referrals", input),
  });
}
