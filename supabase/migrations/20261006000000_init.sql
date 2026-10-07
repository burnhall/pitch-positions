-- Pitch Positions: initial schema
--
-- Who is who
--   Coaches: Supabase Auth users who sign up with email + password. A coaches row is
--            created automatically on sign-up.
--   Players: Auth users created by the server when a kid accepts an invite. They have
--            app_metadata.role = 'player' and no real email; they log in with
--            team code + nickname + PIN.
--
-- Rules enforced here (not just in the app)
--   * A team's data is only visible to its coach and its players.
--   * Players only see homework sets the coach has published.
--   * A player can't see the coach's answer for a situation until they've answered it.
--   * Answers can't be written by users at all: the server scores them and records them
--     with the secret key. One answer per player per situation, so no retries.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Short codes without look-alike characters (no 0/O, 1/I).
create function public.random_code(len int) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, len)
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Coaches
-- ---------------------------------------------------------------------------

create table public.coaches (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') <> 'player' then
    insert into public.coaches (id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Teams and players
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  format text not null check (format in ('5v5', '7v7', '9v9', '11v11')),
  -- the monthly leaderboard resets at midnight on the 1st in this time zone
  timezone text not null default 'UTC',
  join_code text not null unique default public.random_code(6),
  created_at timestamptz not null default now()
);
create index teams_coach_id_idx on public.teams (coach_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 30),
  -- set when the kid accepts their invite
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index players_team_nickname_key on public.players (team_id, lower(trim(nickname)));

-- Kept apart from players so teammates can never read each other's invite links.
create table public.player_invites (
  player_id uuid primary key references public.players (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Homework sets and situations
-- ---------------------------------------------------------------------------

create table public.scenario_sets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  format text not null check (format in ('5v5', '7v7', '9v9', '11v11')),
  settings jsonb not null default '{"teammates": "visible", "timer": 15}',
  -- players only see a set once the coach publishes it
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenario_sets_team_id_idx on public.scenario_sets (team_id);
create trigger scenario_sets_touch before update on public.scenario_sets
  for each row execute function public.touch_updated_at();

-- The picture every player sees: { title, ball, pass, possession, opp, start } (src/lib/pitch/situation.ts)
create table public.situations (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.scenario_sets (id) on delete cascade,
  sort_order int not null default 0,
  setup jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index situations_set_id_idx on public.situations (set_id, sort_order);
create trigger situations_touch before update on public.situations
  for each row execute function public.touch_updated_at();

-- The coach's answer, hidden from each player until they have answered.
create table public.situation_keys (
  situation_id uuid primary key references public.situations (id) on delete cascade,
  model jsonb not null default '{}',
  note text not null default '' check (char_length(note) <= 1000)
);

-- One per player per situation (no retries). Points are frozen when the answer is checked.
create table public.answers (
  situation_id uuid not null references public.situations (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  positions jsonb not null,
  points int not null check (points >= 0),
  max_points int not null check (max_points >= 0),
  checked_at timestamptz not null default now(),
  primary key (situation_id, player_id)
);
create index answers_player_id_idx on public.answers (player_id, checked_at);

-- ---------------------------------------------------------------------------
-- Membership checks used by the security rules.
-- security definer so they can look across tables without tripping each other's rules.
-- ---------------------------------------------------------------------------

create function public.is_team_coach(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams where id = p_team and coach_id = (select auth.uid()))
$$;

create function public.is_team_player(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players where team_id = p_team and user_id = (select auth.uid()))
$$;

create function public.is_set_coach(p_set uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_team_coach((select team_id from public.scenario_sets where id = p_set))
$$;

-- Coach of the team, or a player on it once the set is published.
create function public.can_view_set(p_set uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scenario_sets s
    where s.id = p_set
      and (public.is_team_coach(s.team_id) or (s.published and public.is_team_player(s.team_id)))
  )
$$;

create function public.has_answered(p_situation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.answers a join public.players p on p.id = a.player_id
    where a.situation_id = p_situation and p.user_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.coaches enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_invites enable row level security;
alter table public.scenario_sets enable row level security;
alter table public.situations enable row level security;
alter table public.situation_keys enable row level security;
alter table public.answers enable row level security;

create policy "coach reads own profile" on public.coaches for select to authenticated
  using (id = (select auth.uid()));
create policy "coach updates own profile" on public.coaches for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Row-own checks (coach_id, team_id) rather than lookups by id: a lookup can't see a row
-- that is still being inserted, which would break INSERT ... RETURNING.
create policy "team members read team" on public.teams for select to authenticated
  using (coach_id = (select auth.uid()) or public.is_team_player(id));
create policy "coach creates team" on public.teams for insert to authenticated
  with check (coach_id = (select auth.uid()));
create policy "coach updates team" on public.teams for update to authenticated
  using (public.is_team_coach(id)) with check (coach_id = (select auth.uid()));
create policy "coach deletes team" on public.teams for delete to authenticated
  using (public.is_team_coach(id));

create policy "team members read players" on public.players for select to authenticated
  using (public.is_team_coach(team_id) or public.is_team_player(team_id));
create policy "coach adds players" on public.players for insert to authenticated
  with check (public.is_team_coach(team_id));
create policy "coach renames players" on public.players for update to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "coach removes players" on public.players for delete to authenticated
  using (public.is_team_coach(team_id));

create policy "coach manages invites" on public.player_invites for all to authenticated
  using (public.is_team_coach((select team_id from public.players where id = player_id)))
  with check (public.is_team_coach((select team_id from public.players where id = player_id)));

create policy "read visible sets" on public.scenario_sets for select to authenticated
  using (public.is_team_coach(team_id) or (published and public.is_team_player(team_id)));
create policy "coach creates sets" on public.scenario_sets for insert to authenticated
  with check (public.is_team_coach(team_id));
create policy "coach updates sets" on public.scenario_sets for update to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "coach deletes sets" on public.scenario_sets for delete to authenticated
  using (public.is_team_coach(team_id));

create policy "read situations of visible sets" on public.situations for select to authenticated
  using (public.can_view_set(set_id));
create policy "coach writes situations" on public.situations for all to authenticated
  using (public.is_set_coach(set_id)) with check (public.is_set_coach(set_id));

create policy "coach or answered player reads key" on public.situation_keys for select to authenticated
  using (
    public.is_set_coach((select set_id from public.situations where id = situation_id))
    or public.has_answered(situation_id)
  );
create policy "coach writes keys" on public.situation_keys for all to authenticated
  using (public.is_set_coach((select set_id from public.situations where id = situation_id)))
  with check (public.is_set_coach((select set_id from public.situations where id = situation_id)));

create policy "coach or the player reads answers" on public.answers for select to authenticated
  using (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = (select auth.uid()))
    or public.is_set_coach((select set_id from public.situations where id = situation_id))
  );
-- no insert/update/delete policies on answers: only the server (secret key) writes them

-- Column-level limits on top of the row rules: a coach can rename a player but can't
-- attach someone else's login to them, and nobody can choose their own join code or invite token.
revoke insert, update on public.players from anon, authenticated;
grant insert (team_id, nickname), update (nickname) on public.players to authenticated;
revoke insert, update on public.teams from anon, authenticated;
grant insert (name, format, timezone), update (name, format, timezone) on public.teams to authenticated;
revoke insert, update on public.player_invites from anon, authenticated;
grant insert (player_id) on public.player_invites to authenticated;
revoke insert, update, delete on public.answers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Monthly team leaderboard
-- ---------------------------------------------------------------------------

-- p_month: any date in the month to show; defaults to the current month in the team's time zone.
create function public.team_leaderboard(p_team uuid, p_month date default null)
returns table (player_id uuid, nickname text, situations int, points int, max_points int)
language sql stable security definer set search_path = '' as $$
  with t as (
    select id, timezone,
           date_trunc('month', coalesce(p_month::timestamp, now() at time zone timezone)) as month_start
    from public.teams
    where id = p_team and (public.is_team_coach(p_team) or public.is_team_player(p_team))
  )
  select p.id, p.nickname, count(*)::int, sum(a.points)::int, sum(a.max_points)::int
  from t
  join public.players p on p.team_id = t.id
  join public.answers a on a.player_id = p.id
  where (a.checked_at at time zone t.timezone) >= t.month_start
    and (a.checked_at at time zone t.timezone) < t.month_start + interval '1 month'
  group by p.id, p.nickname
  order by 4 desc, (sum(a.points)::numeric / nullif(sum(a.max_points), 0)) desc nulls last, 2
$$;

revoke execute on function public.team_leaderboard(uuid, date) from public, anon;
grant execute on function public.team_leaderboard(uuid, date) to authenticated;
