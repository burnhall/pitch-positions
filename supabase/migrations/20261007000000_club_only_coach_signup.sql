-- Club-only coach sign-up.
--
-- * The club admin keeps a list of approved coach emails; only those can create a coach
--   account. The database rejects any other sign-up, whatever page or API it comes from.
-- * The very first coach of a fresh install may sign up without approval and becomes the
--   admin. On an existing install, the earliest coach becomes the admin.
-- * Player logins (internal @players.invalid addresses created by the server) are unaffected.

alter table public.coaches add column is_admin boolean not null default false;

update public.coaches set is_admin = true
where id = (select id from public.coaches order by created_at, id limit 1);

-- Coaches may change their own display name, but never their admin flag
revoke update on public.coaches from anon, authenticated;
grant update (display_name) on public.coaches to authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches where id = (select auth.uid()) and is_admin)
$$;

create table public.approved_coach_emails (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  added_by uuid references public.coaches (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.approved_coach_emails enable row level security;
create policy "admin reads approved emails" on public.approved_coach_emails for select to authenticated
  using (public.is_admin());
create policy "admin adds approved emails" on public.approved_coach_emails for insert to authenticated
  with check (public.is_admin());
create policy "admin removes approved emails" on public.approved_coach_emails for delete to authenticated
  using (public.is_admin());
revoke insert, update on public.approved_coach_emails from anon, authenticated;
grant insert (email) on public.approved_coach_emails to authenticated;

create policy "admin reads all coaches" on public.coaches for select to authenticated
  using (public.is_admin());

-- Runs before a login is created: unapproved coach emails never get an account.
create function public.check_coach_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email like '%@players.invalid' then
    return new;
  end if;
  if not exists (select 1 from public.coaches)
     or exists (select 1 from public.approved_coach_emails where email = lower(new.email)) then
    return new;
  end if;
  raise exception 'Coach sign-up is limited to approved club emails' using errcode = 'P0001';
end $$;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.check_coach_signup();

-- The first coach of a fresh install becomes the admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email like '%@players.invalid' or coalesce(new.raw_app_meta_data ->> 'role', '') = 'player' then
    return new;
  end if;
  insert into public.coaches (id, display_name, is_admin)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), not exists (select 1 from public.coaches));
  return new;
end $$;
