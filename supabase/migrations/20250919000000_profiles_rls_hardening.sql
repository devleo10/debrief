-- Users must not update their own credits from the browser client.
drop policy if exists "update own profile" on public.profiles;
