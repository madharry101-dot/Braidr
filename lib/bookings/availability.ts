import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * True if `braiderId` already has a pending/confirmed booking whose
 * [appointment_at, appointment_at + duration) window overlaps the proposed
 * slot. Not specified anywhere in the PRD/TRD as an explicit rule, but
 * double-booking a braider is an obvious correctness requirement for a
 * booking marketplace — implementing it as an application-layer check here.
 *
 * KNOWN LIMITATION: this is a read-then-decide check, not a DB constraint,
 * so two simultaneous requests for the same slot could both pass it (a
 * classic TOCTOU race). The bookings_insert_own_pending RLS policy doesn't
 * prevent this either — RLS controls *who* can write a row, not whether it
 * conflicts with another. Acceptable for MVP traffic volumes; the correct
 * long-term fix is a Postgres EXCLUDE constraint using btree_gist on
 * (braider_id, tstzrange(appointment_at, appointment_at + duration)) WHERE
 * status IN ('pending','confirmed') — worth adding once real booking volume
 * makes the race likely rather than theoretical.
 */
export async function hasOverlappingBooking(
  supabase: SupabaseClient<Database>,
  braiderId: string,
  proposedStart: Date,
  proposedDurationMins: number
): Promise<boolean> {
  const proposedEnd = new Date(proposedStart.getTime() + proposedDurationMins * 60_000);

  // Widest possible existing service duration we'd need to consider is
  // unbounded in theory; in practice cap the lookback window generously
  // (12 hours) rather than joining every service's duration_mins for a
  // simple existence check.
  const lookbackStart = new Date(proposedStart.getTime() - 12 * 60 * 60_000);

  const { data: candidates, error } = await supabase
    .from("bookings")
    .select("appointment_at, service_id")
    .eq("braider_id", braiderId)
    .in("status", ["pending", "confirmed"])
    .gte("appointment_at", lookbackStart.toISOString())
    .lte("appointment_at", proposedEnd.toISOString());

  if (error) throw error;
  if (!candidates || candidates.length === 0) return false;

  // Two-step rather than an embedded `services(duration_mins)` select: the
  // Database type's Relationships arrays are empty for MVP (see
  // types/database.ts), so postgrest-js can't type an embedded resource
  // query here. A second bulk fetch is simpler than adding relationship
  // metadata just for this one query.
  const serviceIds = [...new Set(candidates.map((b) => b.service_id))];
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, duration_mins")
    .in("id", serviceIds);
  if (servicesError) throw servicesError;

  const durationById = new Map((services ?? []).map((s) => [s.id, s.duration_mins]));

  return candidates.some((booking) => {
    const existingStart = new Date(booking.appointment_at);
    const durationMins = durationById.get(booking.service_id) ?? 0;
    const existingEnd = new Date(existingStart.getTime() + durationMins * 60_000);
    return existingStart < proposedEnd && existingEnd > proposedStart;
  });
}
