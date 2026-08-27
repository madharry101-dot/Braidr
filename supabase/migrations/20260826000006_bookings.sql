-- TRD 3.1.4
create table public.bookings (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.profiles(id),
  braider_id               uuid not null references public.braider_profiles(id),
  service_id               uuid not null references public.services(id),
  status                   text not null default 'pending'
                             check (status in (
                               'pending','confirmed','completed',
                               'cancelled_client','cancelled_braider',
                               'disputed','refunded')),
  appointment_at           timestamptz not null,
  -- TRD 3.1.4 / concept doc "Key Decisions": the load-bearing generated
  -- column. Recalculates automatically on reschedule (an UPDATE of
  -- appointment_at) with no application code involved. Uses
  -- minus_24_hours() rather than the bare `appointment_at - interval` —
  -- see that function's comment (20260826000002) for why the plain
  -- expression is rejected by Postgres here.
  braidcare_live_at        timestamptz generated always as (public.minus_24_hours(appointment_at)) stored,
  amount_pence             integer not null,
  commission_pence         integer not null,
  braider_payout_pence     integer not null,
  stripe_payment_intent_id text not null,
  stripe_transfer_id       text,
  sessions_allocated       integer not null default 3,
  sessions_used            integer not null default 0,
  sessions_purchased       integer not null default 0,
  cancellation_reason      text,
  completed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.bookings enable row level security;

create trigger set_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create index idx_bookings_braider_appointment on public.bookings (braider_id, appointment_at);
create index idx_bookings_client_status on public.bookings (client_id, status, created_at desc);

create policy "bookings_select_participant"
  on public.bookings for select
  using (
    client_id = auth.uid()
    or braider_id in (select id from public.braider_profiles where user_id = auth.uid())
  );

-- ENGINEERING NOTE — reconciling two TRD passages that read differently:
-- Section 2.3.1 / the webhook table (9.2) both say checkout.session.completed
-- "creates" the booking record, which would mean no row exists until payment
-- confirms. But stripe_payment_intent_id is NOT NULL (so a row can't be
-- inserted before a PaymentIntent exists), and the payment-flow test table
-- (8.2.2, "Stripe webhook delayed > 30s") explicitly expects a booking
-- "held in pending" while waiting on the webhook — which requires the row to
-- already exist. The only reading that satisfies both: POST /api/bookings
-- creates the Stripe Checkout Session (which mints a PaymentIntent
-- immediately) and inserts the row as 'pending' in the same request, holding
-- the slot; the webhook then updates status -> 'confirmed'. That's what this
-- policy enables — client-side INSERT is only ever allowed to create a
-- 'pending' row.
create policy "bookings_insert_own_pending"
  on public.bookings for insert
  with check (client_id = auth.uid() and status = 'pending');

-- ENGINEERING NOTE: the TRD's RLS summary says braiders can "update status to
-- 'completed' only", but a plain RLS policy can constrain the *new row's*
-- values, not *which columns* an UPDATE statement touches — it can't stop a
-- braider from also rewriting amount_pence or stripe ids in the same
-- statement while flipping status. Rather than bolt on a trigger to
-- individually guard every other column, every status transition (payment
-- confirmation, braider-marks-complete, cancellation + refund, dispute
-- resolution) is written by a Route Handler using the service-role client,
-- after that handler has independently verified the request belongs to the
-- authenticated braider/client and that the transition is valid (e.g.
-- appointment_at has passed, current status is 'confirmed'). This keeps the
-- whole booking state machine in one place instead of splitting it across
-- RLS, triggers, and application code. Consequently there is no
-- authenticated-role UPDATE policy on this table at all.
