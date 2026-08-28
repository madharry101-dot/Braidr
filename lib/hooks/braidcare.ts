"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  BraidcareOverview,
  BraidcareSessionDetail,
  BraidcareSessionStatus,
  BraiderClientSession,
} from "@/lib/types/braidcare";

export function useBraidcareOverview() {
  return useQuery({
    queryKey: ["braidcare", "overview"],
    queryFn: () => api.get<BraidcareOverview>("/braidcare/overview"),
  });
}

export function useBraidcareSession(id: string) {
  return useQuery({
    queryKey: ["braidcare", "session", id],
    queryFn: () => api.get<{ session: BraidcareSessionDetail }>(`/braidcare/sessions/${id}`),
    select: (d) => d.session,
    enabled: Boolean(id),
    // Poll while the analysis runs; stop once it settles.
    refetchInterval: (query) => {
      const s = query.state.data?.session.status as BraidcareSessionStatus | undefined;
      return s === "in_progress" ? 3000 : false;
    },
  });
}

export function useStartBraidcareSession() {
  const qc = useQueryClient();
  return useMutation({
    // booking_id omitted -> standalone session (subscribers only).
    mutationFn: (booking_id?: string) =>
      api.post<{ session: { id: string } }>(
        "/braidcare/sessions",
        booking_id ? { booking_id } : {}
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["braidcare", "overview"] }),
  });
}

export function useAnalyseBraidcareSession(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ session: BraidcareSessionDetail } | { status: "queued"; message: string }>(
        `/braidcare/sessions/${id}/analyse`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["braidcare", "session", id] });
      qc.invalidateQueries({ queryKey: ["braidcare", "overview"] });
    },
  });
}

export function useSubscribeBraidcare() {
  return useMutation({
    mutationFn: () => api.post<{ checkout_url: string }>("/braidcare/subscribe"),
  });
}

export function useCancelBraidcareSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del<{ cancel_at_period_end: boolean }>("/braidcare/subscribe"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["braidcare", "overview"] }),
  });
}

export function useBraiderClientSessions() {
  return useQuery({
    queryKey: ["braidcare", "braider-sessions"],
    queryFn: () =>
      api.get<{ subscribed: boolean; sessions: BraiderClientSession[] }>(
        "/braidcare/braider-sessions"
      ),
  });
}

export function useBraiderBraidcareSubscribe() {
  return useMutation({
    mutationFn: () => api.post<{ checkout_url: string }>("/braidcare/braider-subscribe"),
  });
}
