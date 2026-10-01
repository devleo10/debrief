-- Audit trail + idempotency for credit spend/refund

create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('spend', 'refund', 'refund_failed')),
  delta integer not null,
  idempotency_key text,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_events_spend_idempotency
  on public.credit_events (user_id, idempotency_key)
  where event_type = 'spend' and idempotency_key is not null;

create unique index if not exists credit_events_refund_idempotency
  on public.credit_events (user_id, idempotency_key)
  where event_type = 'refund' and idempotency_key is not null;

alter table public.credit_events enable row level security;

-- No client policies — service role only.

create index if not exists credit_events_user_created
  on public.credit_events (user_id, created_at desc);
