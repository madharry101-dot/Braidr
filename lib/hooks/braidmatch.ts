"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { BraiderCard, BraiderDetail, Booking, BookingDetail } from "@/lib/types/braidmatch";
import type { HairTexture } from "@/lib/hair/textures";

export type BraiderFilters = {
  city?: string;
  style?: string;
  /** Plain-language hair texture — matches braiders VERIFIED for it. */
  texture?: HairTexture;
  price_max_pence?: number;
  braidcare_only?: boolean;
  verified_only?: boolean;
};

export function useBraiderSearch(filters: BraiderFilters) {
  const qs = new URLSearchParams();
  if (filters.city) qs.set("city", filters.city);
  if (filters.style) qs.set("style", filters.style);
  if (filters.texture) qs.set("texture", filters.texture);
  if (filters.price_max_pence) qs.set("price_max_pence", String(filters.price_max_pence));
  if (filters.braidcare_only) qs.set("braidcare_only", "true");
  if (filters.verified_only) qs.set("verified_only", "true");
  const query = qs.toString();

  return useQuery({
    queryKey: ["braiders", query],
    queryFn: () => api.get<{ braiders: BraiderCard[] }>(`/braiders${query ? `?${query}` : ""}`),
    select: (d) => d.braiders,
  });
}

export function useBraider(id: string) {
  return useQuery({
    queryKey: ["braider", id],
    queryFn: () => api.get<BraiderDetail>(`/braiders/${id}`),
    enabled: Boolean(id),
  });
}

export function useAvailability(
  braiderId: string,
  serviceId: string,
  dateFrom: string,
  dateTo: string,
  enabled = true
) {
  return useQuery({
    queryKey: ["availability", braiderId, serviceId, dateFrom, dateTo],
    queryFn: () =>
      api.get<{ slots: string[] }>(
        `/braiders/${braiderId}/availability?service_id=${serviceId}&date_from=${dateFrom}&date_to=${dateTo}`
      ),
    select: (d) => d.slots,
    enabled: enabled && Boolean(braiderId && serviceId),
  });
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: (input: { braider_id: string; service_id: string; appointment_at: string }) =>
      api.post<{ booking_id: string; checkout_url: string }>("/bookings", input),
  });
}

export function useBookings() {
  return useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.get<{ bookings: Booking[] }>("/bookings"),
    select: (d) => d.bookings,
  });
}

export function useBooking(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["booking", id],
    queryFn: () => api.get<{ booking: BookingDetail }>(`/bookings/${id}`),
    select: (d) => d.booking,
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCancelBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      api.post<{ cancelled: boolean; refund_pence: number }>(`/bookings/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useRescheduleBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (new_appointment_at: string) =>
      api.post<{ pending_reschedule_at: string }>(`/bookings/${id}/reschedule`, {
        new_appointment_at,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useConfirmReschedule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ appointment_at: string }>(`/bookings/${id}/confirm-reschedule`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useCompleteBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ status: string }>(`/bookings/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

/** Braider's optional post-appointment hair-type confirmation (Part 1). */
export function useConfirmClientHairType(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hair_type: string) =>
      api.post<{ hair_type: string; source: string }>(`/bookings/${id}/confirm-hair-type`, {
        hair_type,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", id] }),
  });
}
