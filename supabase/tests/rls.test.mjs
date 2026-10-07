// Runs the Pitch Positions migration on PGlite with a minimal stand-in for Supabase's
// auth schema and roles, then checks the security rules from each user's point of view.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const migration = readFileSync(process.argv[2], "utf8");

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
await db.exec(migration);

const ids = { coachA: "a0000000-0000-0000-0000-00000000000a", coachB: "b0000000-0000-0000-0000-00000000000b",
  kid1: "c0000000-0000-0000-0000-000000000001", kid2: "c0000000-0000-0000-0000-000000000002" };
await db.exec(`insert into auth.users (id, raw_user_meta_data) values
  ('${ids.coachA}', '{"display_name":"Coach A"}'), ('${ids.coachB}', '{}');
  insert into auth.users (id, raw_app_meta_data) values
  ('${ids.kid1}', '{"role":"player"}'), ('${ids.kid2}', '{"role":"player"}');`);

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

// Run a query as a signed-in user (or as the superuser/server when user is null).
async function as(user, sql, params = []) {
  await db.exec("begin");
  try {
    if (user) {
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids[user]]);
      await db.exec("set local role authenticated");
    }
    const r = await db.query(sql, params);
    await db.exec("commit");
    return { rows: r.rows };
  } catch (e) {
    await db.exec("rollback");
    return { error: e.message };
  }
}

const coaches = await as(null, "select id, display_name from public.coaches order by id");
check("sign-up creates coach rows only for coaches", coaches.rows.length === 2 && coaches.rows[0].display_name === "Coach A");

const team = await as("coachA", "insert into public.teams (name, format) values ('U10 Blue', '7v7') returning *");
check("coach creates a team", team.rows?.length === 1, team.error);
const teamId = team.rows[0].id;
check("team gets coach_id and a 6-char join code", team.rows[0].coach_id === ids.coachA && /^[A-Z2-9]{6}$/.test(team.rows[0].join_code), team.rows[0].join_code);

check("player account can't create a team", !!(await as("kid1", "insert into public.teams (name, format) values ('Hack', '5v5')")).error);
check("coach can't pick their own join code", !!(await as("coachA", "insert into public.teams (name, format, join_code) values ('X', '5v5', 'AAAAAA')")).error);

const p = await as("coachA", "insert into public.players (team_id, nickname) values ($1, 'Sara'), ($1, 'Leo') returning id, nickname", [teamId]);
check("coach adds players", p.rows?.length === 2, p.error);
const [sara, leo] = p.rows;
check("nicknames are unique per team (case-insensitive)", !!(await as("coachA", "insert into public.players (team_id, nickname) values ($1, ' sara ')", [teamId])).error);
check("coach B can't add players to coach A's team", !!(await as("coachB", "insert into public.players (team_id, nickname) values ($1, 'Spy')", [teamId])).error);

const inv = await as("coachA", "insert into public.player_invites (player_id) values ($1), ($2) returning token", [sara.id, leo.id]);
check("coach creates invites", inv.rows?.length === 2, inv.error);

// The server accepts Sara's invite: links her login and removes the invite
await as(null, "update public.players set user_id = $1 where id = $2; ", [ids.kid1, sara.id]);
await as(null, "delete from public.player_invites where player_id = $1", [sara.id]);
await as(null, "update public.players set user_id = $1 where id = $2", [ids.kid2, leo.id]);

check("coach can't attach a login to a player", !!(await as("coachA", "update public.players set user_id = $1 where id = $2", [ids.coachB, sara.id])).error);
check("coach B sees no teams", (await as("coachB", "select * from public.teams")).rows.length === 0);
check("player sees their team", (await as("kid1", "select * from public.teams")).rows.length === 1);
check("player sees teammates", (await as("kid1", "select * from public.players")).rows.length === 2);
check("player can't see invite tokens", (await as("kid1", "select * from public.player_invites")).rows.length === 0);
check("player can't rename themselves", (await as("kid1", "update public.players set nickname = 'Boss' where id = $1 returning id", [sara.id])).rows?.length !== 1);

const set = await as("coachA", "insert into public.scenario_sets (team_id, name, format) values ($1, 'Week 1', '7v7') returning id", [teamId]);
const setId = set.rows[0].id;
const sits = await as("coachA", `insert into public.situations (set_id, sort_order, setup) values ($1, 0, '{"title":"one"}'), ($1, 1, '{"title":"two"}') returning id`, [setId]);
check("coach adds situations", sits.rows?.length === 2, sits.error);
const [s1, s2] = sits.rows;
const keys = await as("coachA", `insert into public.situation_keys (situation_id, model, note) values ($1, '{"LB":{"x":0.2,"y":0.3}}', 'drop back'), ($2, '{}', 'secret') returning situation_id`, [s1.id, s2.id]);
check("coach writes answer keys", keys.rows?.length === 2, keys.error);

check("player can't see an unpublished set", (await as("kid1", "select * from public.scenario_sets")).rows.length === 0);
check("player can't see its situations either", (await as("kid1", "select * from public.situations")).rows.length === 0);
await as("coachA", "update public.scenario_sets set published = true where id = $1", [setId]);
check("player sees the set once published", (await as("kid1", "select * from public.scenario_sets")).rows.length === 1);
check("player sees its situations", (await as("kid1", "select * from public.situations")).rows.length === 2);
check("player can't see any answer key before answering", (await as("kid1", "select * from public.situation_keys")).rows.length === 0);
check("player can't edit situations", (await as("kid1", "update public.situations set setup = '{}' returning id")).rows?.length !== 2);

check("player can't write their own answer (server only)", !!(await as("kid1", `insert into public.answers (situation_id, player_id, positions, points, max_points) values ($1, $2, '{}', 700, 700)`, [s1.id, sara.id])).error);
const ans = await as(null, `insert into public.answers (situation_id, player_id, positions, points, max_points) values ($1, $2, '{}', 520, 700)`, [s1.id, sara.id]);
check("server records a scored answer", !ans.error, ans.error);
check("no retries: second answer for the same situation is rejected", !!(await as(null, `insert into public.answers (situation_id, player_id, positions, points, max_points) values ($1, $2, '{}', 700, 700)`, [s1.id, sara.id])).error);

const k = await as("kid1", "select situation_id, note from public.situation_keys");
check("after answering, player sees that key only", k.rows.length === 1 && k.rows[0].situation_id === s1.id);
check("teammate still can't see that key", (await as("kid2", "select * from public.situation_keys")).rows.length === 0);
check("teammate can't see Sara's answers", (await as("kid2", "select * from public.answers")).rows.length === 0);
check("Sara sees her own answer", (await as("kid1", "select * from public.answers")).rows.length === 1);
check("coach sees all answers", (await as("coachA", "select * from public.answers")).rows.length === 1);
check("coach B sees no answers", (await as("coachB", "select * from public.answers")).rows.length === 0);

await as(null, `insert into public.answers (situation_id, player_id, positions, points, max_points, checked_at) values ($1, $2, '{}', 300, 700, now() - interval '40 days')`, [s1.id, leo.id]);
const lb = await as("kid2", "select nickname, situations, points from public.team_leaderboard($1)", [teamId]);
check("leaderboard shows this month only", lb.rows?.length === 1 && lb.rows[0].nickname === "Sara" && lb.rows[0].points === 520, JSON.stringify(lb.rows ?? lb.error));
const lbOld = await as("kid2", "select nickname from public.team_leaderboard($1, (now() - interval '40 days')::date)", [teamId]);
check("earlier months stay viewable", lbOld.rows?.length === 1 && lbOld.rows[0].nickname === "Leo", JSON.stringify(lbOld.rows ?? lbOld.error));
check("other coach gets an empty leaderboard", (await as("coachB", "select * from public.team_leaderboard($1)", [teamId])).rows.length === 0);

check("deleting the team removes everything", !(await as("coachA", "delete from public.teams where id = $1", [teamId])).error
  && (await as(null, "select count(*)::int n from public.answers")).rows[0].n === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
