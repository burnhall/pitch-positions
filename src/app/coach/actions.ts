"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireCoach } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";
import { normalizeNickname } from "@/lib/players";
import { isFormatId } from "@/lib/pitch/formats";
import { text, type FormState } from "@/lib/form";

// ---------- coach account ----------

export async function signUpCoach(_: FormState, fd: FormData): Promise<FormState> {
  const name = text(fd, "name");
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Please enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };
  if (email.endsWith("@players.invalid")) return { error: "Please use your own email address." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name }, emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error) return { error: error.message };
  // With email confirmation off, Supabase signs the coach straight in
  if (data.session) redirect("/coach");
  return { message: `Almost done! We sent a confirmation link to ${email}. Open it to finish signing up.` };
}

export async function signInCoach(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(fd, "email").toLowerCase(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: "Please confirm your email first: check your inbox for the link." };
    return { error: "That email and password don't match." };
  }
  redirect("/coach");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------- teams ----------

const isTimeZone = (tz: string) => tz === "UTC" || Intl.supportedValuesOf("timeZone").includes(tz);

export async function createTeam(_: FormState, fd: FormData): Promise<FormState> {
  await requireCoach();
  const name = text(fd, "name");
  const format = text(fd, "format");
  const timezone = text(fd, "timezone");
  if (!name || name.length > 60) return { error: "Give the team a name (up to 60 characters)." };
  if (!isFormatId(format)) return { error: "Choose a format." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ name, format, timezone: isTimeZone(timezone) ? timezone : "UTC" })
    .select("id")
    .single();
  if (error) return { error: "Couldn't create the team. Please try again." };
  redirect(`/coach/teams/${data.id}`);
}

// ---------- players ----------

/** Adds players from a list of nicknames (one per line) and creates an invite for each. */
export async function addPlayers(teamId: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireCoach();
  // Unique ignoring case, keeping the first spelling typed
  const names: string[] = [];
  for (const n of String(fd.get("nicknames") ?? "").split(/[\n,]/).map(normalizeNickname).filter(Boolean)) {
    if (!names.some((m) => m.toLowerCase() === n.toLowerCase())) names.push(n);
  }
  if (!names.length) return { error: "Type at least one nickname." };
  if (names.length > 40) return { error: "Add up to 40 players at a time." };
  const tooLong = names.find((n) => n.length > 30);
  if (tooLong) return { error: `"${tooLong}" is too long (30 characters max).` };

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase.from("players").select("nickname").eq("team_id", teamId);
  if (readError) return { error: "Couldn't load the team." };
  const taken = new Set((existing ?? []).map((p) => p.nickname.toLowerCase()));
  const fresh = names.filter((n) => !taken.has(n.toLowerCase()));
  const skipped = names.filter((n) => taken.has(n.toLowerCase()));

  if (fresh.length) {
    const { data: added, error } = await supabase
      .from("players")
      .insert(fresh.map((nickname) => ({ team_id: teamId, nickname })))
      .select("id");
    if (error) return { error: "Couldn't add the players. Please try again." };
    const { error: inviteError } = await supabase.from("player_invites").insert(added.map((p) => ({ player_id: p.id })));
    if (inviteError) return { error: "Players were added, but their invites couldn't be created. Use \"New invite\" on each." };
  }
  refresh();
  const parts = [];
  if (fresh.length) parts.push(`Added ${fresh.length} player${fresh.length > 1 ? "s" : ""}.`);
  if (skipped.length) parts.push(`Already on the team: ${skipped.join(", ")}.`);
  return { message: parts.join(" ") };
}

/** Replaces a player's invite. For a player who already joined, using it sets a new PIN. */
export async function newInvite(fd: FormData) {
  await requireCoach();
  const playerId = text(fd, "playerId");
  const supabase = await createSupabaseServerClient();
  await supabase.from("player_invites").delete().eq("player_id", playerId);
  await supabase.from("player_invites").insert({ player_id: playerId });
  refresh();
}

export async function removePlayer(fd: FormData) {
  await requireCoach();
  const playerId = text(fd, "playerId");
  const supabase = await createSupabaseServerClient();
  // The security rules only let a coach delete players on their own teams
  const { data } = await supabase.from("players").delete().eq("id", playerId).select("user_id").maybeSingle();
  if (data?.user_id) await createSupabaseAdminClient().auth.admin.deleteUser(data.user_id);
  refresh();
}
