import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Data Access Layer: every page and action finds out who is signed in through here.
// The database's security rules still decide what each person can actually read or change.

/** The signed-in user, checked with Supabase Auth (not just read from the cookie). */
export const getUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Player logins are never coaches, whatever the database says. */
const isPlayerLogin = (user: User) => !!user.email?.endsWith("@players.invalid") || user.app_metadata.role === "player";

export type Coach = { id: string; email: string; displayName: string; isAdmin: boolean; mustChangePassword: boolean };

/**
 * Signed-in coach, even one still signed in on the temporary password the club admin gave
 * them. Only the account page uses this directly; everything else goes through requireCoach.
 */
export const requireCoachAccount = cache(async (): Promise<Coach> => {
  const user = await getUser();
  if (!user) redirect("/coach/sign-in");
  if (isPlayerLogin(user)) redirect("/play");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("coaches").select("display_name, is_admin").eq("id", user.id).maybeSingle();
  if (!data) redirect("/play");
  return {
    id: user.id, email: user.email ?? "", displayName: data.display_name, isAdmin: data.is_admin,
    mustChangePassword: user.app_metadata.must_change_password === true,
  };
});

/**
 * Signed-in coach, or a redirect: to sign-in if signed out, to /play if this is a player,
 * to the account page if they must replace a temporary password first.
 */
export const requireCoach = cache(async (): Promise<Coach> => {
  const coach = await requireCoachAccount();
  if (coach.mustChangePassword) redirect("/coach/account");
  return coach;
});

/** Signed-in club admin (manages which emails may sign up as coaches). */
export const requireAdmin = cache(async (): Promise<Coach> => {
  const coach = await requireCoach();
  if (!coach.isAdmin) redirect("/coach");
  return coach;
});

export type Player = { id: string; nickname: string; team: { id: string; name: string; format: string; joinCode: string; timezone: string } };

/** Signed-in player with their team, or a redirect to the player login. */
export const requirePlayer = cache(async (): Promise<Player> => {
  const user = await getUser();
  if (!user) redirect("/play/login");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("players")
    .select("id, nickname, teams (id, name, format, join_code, timezone)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/coach");
  const team = data.teams as unknown as { id: string; name: string; format: string; join_code: string; timezone: string };
  return { id: data.id, nickname: data.nickname, team: { id: team.id, name: team.name, format: team.format, joinCode: team.join_code, timezone: team.timezone } };
});
