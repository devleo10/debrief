-- Idempotent credit grant for a verified Dodo payment.

alter table public.credit_events
  drop constraint if exists credit_events_event_type_check;

alter table public.credit_events
  add constraint credit_events_event_type_check
  check (event_type in ('spend', 'refund', 'refund_failed', 'purchase'));

create unique index if not exists credit_events_purchase_payment
  on public.credit_events (idempotency_key)
  where event_type = 'purchase' and idempotency_key is not null;

create or replace function public.grant_purchased_credits(
  p_user_id uuid,
  p_payment_id text,
  p_credits int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
  inserted_id uuid;
begin
  if p_credits < 1 or p_credits > 100 then
    raise exception 'invalid_credits';
  end if;
  if p_payment_id is null or length(trim(p_payment_id)) < 4 then
    raise exception 'invalid_payment';
  end if;

  insert into public.credit_events (user_id, event_type, delta, idempotency_key, note)
  values (p_user_id, 'purchase', p_credits, p_payment_id, 'dodo payment.succeeded')
  on conflict (idempotency_key) where event_type = 'purchase' and idempotency_key is not null
  do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select credits into remaining from public.profiles where id = p_user_id;
    if not found then
      raise exception 'profile_not_found';
    end if;
    return remaining;
  end if;

  update public.profiles
  set credits = credits + p_credits
  where id = p_user_id
  returning credits into remaining;

  if not found then
    raise exception 'profile_not_found';
  end if;

  return remaining;
end;
$$;

revoke all on function public.grant_purchased_credits(uuid, text, int) from public;
grant execute on function public.grant_purchased_credits(uuid, text, int) to service_role;
