-- TRD 3.1.8
create table public.income_records (
  id                 uuid primary key default gen_random_uuid(),
  braider_id         uuid not null references public.braider_profiles(id),
  booking_id         uuid not null unique references public.bookings(id),
  service_name       text not null,
  gross_amount_pence integer not null,
  commission_pence   integer not null,
  net_amount_pence   integer not null,
  tax_year           text not null,
  payment_date       date not null,
  created_at         timestamptz not null default now()
);

alter table public.income_records enable row level security;

create index idx_income_records_braider_tax_year on public.income_records (braider_id, tax_year, payment_date);

create policy "income_records_select_own"
  on public.income_records for select
  using (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

-- No INSERT/UPDATE/DELETE policy for authenticated users: this is an
-- immutable tax ledger written only by the Stripe webhook handler via the
-- service role key (TRD 3.1.8: "INSERT: via service role only").
