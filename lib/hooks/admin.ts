"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AdminReferral,
  AdminUser,
  Announcement,
  DisputeRow,
  ModerationLogEntry,
  PendingBraider,
  PendingExpert,
  PlatformReport,
} from "@/lib/types/admin";

export function usePlatformReport(period: "week" | "month" = "week") {
  return useQuery({
    queryKey: ["admin", "report", period],
    queryFn: () => api.get<PlatformReport>(`/admin/reports/platform?period=${period}`),
  });
}

export function usePendingBraiders() {
  return useQuery({
    queryKey: ["admin", "pending-braiders"],
    queryFn: () => api.get<{ pending: PendingBraider[] }>("/admin/braiders/pending"),
    select: (d) => d.pending,
  });
}

export function usePendingExperts() {
  return useQuery({
    queryKey: ["admin", "pending-experts"],
    queryFn: () => api.get<{ pending: PendingExpert[] }>("/admin/experts/pending"),
    select: (d) => d.pending,
  });
}

export function useVerifyBraider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      api.put(`/admin/braiders/${id}/verify`, { approve, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pending-braiders"] }),
  });
}

export function useVerifyExpert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      api.put(`/admin/experts/${id}/verify`, { approve, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pending-experts"] }),
  });
}

export function useExpertCredentialUrl() {
  return useMutation({
    mutationFn: (id: string) => api.get<{ url: string }>(`/admin/experts/${id}/credential-url`),
  });
}

export function useDisputes() {
  return useQuery({
    queryKey: ["admin", "disputes"],
    queryFn: () => api.get<{ disputes: DisputeRow[] }>("/admin/bookings/disputes"),
    select: (d) => d.disputes,
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      resolution,
      note,
      refund_pence,
    }: {
      id: string;
      resolution: "refund" | "dismiss";
      note: string;
      refund_pence?: number;
    }) => api.put(`/admin/bookings/${id}/resolve`, { resolution, note, refund_pence }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "disputes"] }),
  });
}

export function useAdminUsers(filters: { role?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (filters.role) qs.set("role", filters.role);
  if (filters.search) qs.set("search", filters.search);
  const q = qs.toString();
  return useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api.get<{ users: AdminUser[] }>(`/admin/users${q ? `?${q}` : ""}`),
    select: (d) => d.users,
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      api.put(`/admin/users/${id}/suspend`, { suspended }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ mode: string; reason?: string }>(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminReferrals() {
  return useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: () => api.get<{ referrals: AdminReferral[] }>("/experts/referrals"),
    select: (d) => d.referrals,
  });
}

export function useCompleteReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, referral_fee_pence }: { id: string; referral_fee_pence: number }) =>
      api.put(`/experts/referrals/${id}/complete`, { referral_fee_pence }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "referrals"] }),
  });
}

export function useModerationLog() {
  return useQuery({
    queryKey: ["admin", "moderation-log"],
    queryFn: () => api.get<{ log: ModerationLogEntry[] }>("/admin/content/moderation-log"),
    select: (d) => d.log,
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () => api.get<{ announcements: Announcement[] }>("/admin/notifications"),
    select: (d) => d.announcements,
  });
}

export function useSendAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { segment: Record<string, unknown>; subject: string; message: string }) =>
      api.post<{ recipient_count: number }>("/admin/notifications", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "announcements"] }),
  });
}
