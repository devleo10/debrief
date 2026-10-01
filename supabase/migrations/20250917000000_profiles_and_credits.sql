-- Profiles + credit ledger for Debrief

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  credits integer not null default 2 check (credits >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- New signups get a profile + starting credits.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 2)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-side credit spend (called from Next.js with service role).
create or replace function public.spend_credit(p_user_id uuid, cost int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare remaining int;
begin
  if cost < 1 then
    raise exception 'invalid_cost';
  end if;

  update public.profiles
  set credits = credits - cost
  where id = p_user_id and credits >= cost
  returning credits into remaining;

  if not found then
    raise exception 'insufficient_credits';
  end if;

  return remaining;
end;
$$;

create or replace function public.refund_credit(p_user_id uuid, cost int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare remaining int;
begin
  if cost < 1 then
    raise exception 'invalid_cost';
  end if;

  update public.profiles
  set credits = credits + cost
  where id = p_user_id
  returning credits into remaining;

  if not found then
    raise exception 'profile_not_found';
  end if;

  return remaining;
end;
$$;

revoke all on function public.spend_credit(uuid, int) from public;
revoke all on function public.refund_credit(uuid, int) from public;
grant execute on function public.spend_credit(uuid, int) to service_role;
grant execute on function public.refund_credit(uuid, int) to service_role;
