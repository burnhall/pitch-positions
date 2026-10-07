-- Player logins are created through the admin API, which writes app_metadata *after* the
-- user row is inserted, so the sign-up trigger never saw role = 'player' and gave every
-- player a coaches row. Recognise players by their internal login address instead
-- (p-<player id>@players.invalid, see src/lib/players.ts), which is known at insert.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email like '%@players.invalid' or coalesce(new.raw_app_meta_data ->> 'role', '') = 'player' then
    return new;
  end if;
  insert into public.coaches (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  return new;
end $$;

-- Clean up any coach rows created for player logins before this fix.
delete from public.coaches c
using auth.users u
where u.id = c.id and u.email like '%@players.invalid';
