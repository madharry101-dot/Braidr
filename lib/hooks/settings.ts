"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { NotificationEvent } from "@/lib/settings/notifications";
import type { Role } from "@/types/database";

export type SettingsProfile = {
  role: Role;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  date_of_birth: string | null;
  hair_type: string | null;
  referral_code: string;
  email: string | undefined;
};

export function useSettingsProfile() {
  return useQuery({
    queryKey: ["settings", "profile"],
    queryFn: () => api.get<SettingsProfile>("/settings/profile"),
  });
}

export function useUpdateSettingsProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Record<string, string | null>>) =>
      api.put<{ updated: boolean }>("/settings/profile", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "profile"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["settings", "notifications"],
    queryFn: () =>
      api.get<{ events: NotificationEvent[]; preferences: Record<string, boolean> }>(
        "/settings/notifications"
      ),
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      api.put<{ preferences: Record<string, boolean> }>("/settings/notifications", { preferences }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "notifications"] }),
  });
}

export function useMarketingConsent() {
  return useQuery({
    queryKey: ["settings", "marketing"],
    queryFn: () => api.get<{ opted_in: boolean }>("/settings/marketing"),
  });
}

export function useUpdateMarketingConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opted_in: boolean) =>
      api.put<{ opted_in: boolean }>("/settings/marketing", { opted_in }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "marketing"] }),
  });
}

export type BillingInfo = {
  braidcare_subscription: {
    status: "active" | "cancelled" | "past_due";
    price_pence: number;
    current_period_end: string;
  } | null;
  braidr_pro: { subscribed: boolean } | null;
  invoices: { amount_pence: number; date: string; pdf: string | null; status: string }[];
};

export function useBillingInfo() {
  return useQuery({
    queryKey: ["settings", "billing"],
    queryFn: () => api.get<BillingInfo>("/settings/billing"),
  });
}
