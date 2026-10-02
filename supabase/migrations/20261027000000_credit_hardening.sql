-- Harden credits.
--
-- 1. Spend and refund are atomic with their audit events, so concurrent
--    retries cannot double-charge or double-refund.
-- 2. A refund is only allowed when a matching spend exists for the same
--    (user, idempotency key). Refunds are additive and were previously
--    callable with any key, which let a signed-in user mint credits.
-- 3. A key that was refunded can never be spent again. Replaying it now
--    fails instead of silently producing a free run.
-- 4. Purchased credits can be revoked when a payment is refunded or lost
--    to a chargeback.

alter table public.credit_events
  drop constraint if exists credit_events_event_type_check;

alter table public.credit_events
  add constraint credit_events_event_type_check
  check (
    event_type in (
      'spend',
      'refund',
      'refund_failed',
      'purchase',
      'revoke',
      'revoke_failed'
    )
  );

create unique index if not exists credit_events_revoke_idempotency
  on public.credit_events (user_id, idempotency_key)
  where event_type = 'revoke' and idempotency_key is not null;

-- The old spend/refund functions had no idempotency key and no proof that a
-- spend happened. Remove them so nothing can call the weak version.
drop function if exists public.spend_credit(uuid, int);
drop function if exists public.refund_credit(uuid, int);

create or replace function public.spend_credit(
  p_user_id uuid,
  p_cost int,
  p_idempotency_key text
) returns table (remaining int, charged boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
  current_credits int;
begin
  if p_cost < 1 then
    raise exception 'invalid_cost';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  insert into public.credit_events (user_id, event_type, delta, idempotency_key, note)
  values (p_user_id, 'spend', -p_cost, p_idempotency_key, 'briefing')
  on conflict (user_id, idempotency_key)
    where event_type = 'spend' and idempotency_key is not null
  do nothing
  returning id into inserted_id;

  if inserted_id is null then
    -- This key already ran. If it was refunded, it is finished for good.
    if exists (
      select 1
      from public.credit_events
      where user_id = p_user_id
        and event_type = 'refund'
        and idempotency_key = p_idempotency_key
    ) then
      raise exception 'key_refunded';
    end if;

    select credits into current_credits
    from public.profiles
    where id = p_user_id;

    if not found then
      raise exception 'profile_not_found';
    end if;

    return query select current_credits, false;
    return;
  end if;

  update public.profiles
  set credits = credits - p_cost
  where id = p_user_id and credits >= p_cost
  returning credits into current_credits;

  if not found then
    -- Rolls back the event insert above.
    raise exception 'insufficient_credits';
  end if;

  return query select current_credits, true;
end;
$$;

revoke all on function public.spend_credit(uuid, int, text) from public;
grant execute on function public.spend_credit(uuid, int, text) to service_role;

create or replace function public.refund_credit(
  p_user_id uuid,
  p_cost int,
  p_idempotency_key text,
  p_note text default null
) returns table (remaining int, refunded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
  current_credits int;
begin
  if p_cost < 1 then
    raise exception 'invalid_cost';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  if not exists (
    select 1
    from public.credit_events
    where user_id = p_user_id
      and event_type = 'spend'
      and idempotency_key = p_idempotency_key
      and delta = -p_cost
  ) then
    raise exception 'no_spend_for_key';
  end if;

  insert into public.credit_events (user_id, event_type, delta, idempotency_key, note)
  values (
    p_user_id,
    'refund',
    p_cost,
    p_idempotency_key,
    coalesce(p_note, 'briefing_failed')
  )
  on conflict (user_id, idempotency_key)
    where event_type = 'refund' and idempotency_key is not null
  do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select credits into current_credits
    from public.profiles
    where id = p_user_id;

    if not found then
      raise exception 'profile_not_found';
    end if;

    return query select current_credits, false;
    return;
  end if;

  update public.profiles
  set credits = credits + p_cost
  where id = p_user_id
  returning credits into current_credits;

  if not found then
    -- Rolls back the refund event insert above.
    raise exception 'profile_not_found';
  end if;

  return query select current_credits, true;
end;
$$;

revoke all on function public.refund_credit(uuid, int, text, text) from public;
grant execute on function public.refund_credit(uuid, int, text, text) to service_role;

create or replace function public.revoke_purchased_credits(
  p_payment_id text,
  p_revoke_key text
) returns table (remaining int, revoked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase record;
  inserted_id uuid;
  current_credits int;
  revoke_amount int;
begin
  if p_payment_id is null or length(trim(p_payment_id)) < 4 then
    raise exception 'invalid_payment';
  end if;

  if p_revoke_key is null or length(trim(p_revoke_key)) < 4 then
    raise exception 'invalid_revoke_key';
  end if;

  select user_id, delta
  into purchase
  from public.credit_events
  where event_type = 'purchase'
    and idempotency_key = p_payment_id
  limit 1;

  if not found then
    return query select null::int, false;
    return;
  end if;

  revoke_amount := purchase.delta;
  if revoke_amount < 1 then
    return query select null::int, false;
    return;
  end if;

  insert into public.credit_events (user_id, event_type, delta, idempotency_key, note)
  values (
    purchase.user_id,
    'revoke',
    -revoke_amount,
    p_revoke_key,
    'payment reversed'
  )
  on conflict (user_id, idempotency_key)
    where event_type = 'revoke' and idempotency_key is not null
  do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select credits into current_credits
    from public.profiles
    where id = purchase.user_id;

    if not found then
      raise exception 'profile_not_found';
    end if;

    return query select current_credits, false;
    return;
  end if;

  update public.profiles
  set credits = greatest(credits - revoke_amount, 0)
  where id = purchase.user_id
  returning credits into current_credits;

  if not found then
    raise exception 'profile_not_found';
  end if;

  return query select current_credits, true;
end;
$$;

revoke all on function public.revoke_purchased_credits(text, text) from public;
grant execute on function public.revoke_purchased_credits(text, text) to service_role;
