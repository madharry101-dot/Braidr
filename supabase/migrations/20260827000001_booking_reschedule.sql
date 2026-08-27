-- ENGINEERING NOTE (schema gap fix): TRD 4.4 specifies two endpoints —
-- POST /api/bookings/:id/reschedule ("Request reschedule; notifies other
-- party") and POST /api/bookings/:id/confirm-reschedule ("Confirm
-- reschedule; updates braidcare_live_at") — describing a propose/confirm
-- negotiation (PRD FR-MATCH-02.7: "both parties must agree"). But the
-- bookings table (TRD 3.1.4) has nowhere to store a proposed-but-unconfirmed
-- new time. Adding the two columns that negotiation needs; appointment_at
-- itself (and therefore braidcare_live_at) only changes once the other
-- participant confirms.
alter table public.bookings
  add column pending_reschedule_at timestamptz,
  add column reschedule_requested_by uuid references public.profiles(id);
