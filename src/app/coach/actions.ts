"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireAdmin, requireCoach } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";
import { normalizeNickname } from "@/lib/players";
import { FORMATS, isFormatId } from "@/lib/pitch/formats";
import { defaultSetup } from "@/lib/pitch/situation";
import { cleanKey, cleanSetup, missingFromKey } from "@/lib/pitch/validate";
import { text, type FormState } from "@/lib/form";

// ---------- coach account ----------

const NOT_APPROVED = "Sign-up is for our club's coaches only. Ask the club admin to add your email address first.";

/** Only emails the club admin approved may sign up (the first coach of a fresh install excepted). */
async function mayCoachSignUp(email: string) {
  const admin = createSupabaseAdminClient();
  const { count } = await admin.from("coaches").select("*", { count: "exact", head: true });
  if (!count) return true;
  const { data } = await admin.from("approved_coach_emails").select("email").eq("email", email).maybeSingle();
  return !!data;
}

export async function signUpCoach(_: FormState, fd: FormData): Promise<FormState> {
  const name = text(fd, "name");
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Please enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };
  if (email.endsWith("@players.invalid")) return { error: "Please use your own email address." };
  if (!(await mayCoachSignUp(email))) return { error: NOT_APPROVED };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name }, emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  // The database also refuses unapproved emails, in case the list changed meanwhile
  if (error) return { error: /database error/i.test(error.message) ? NOT_APPROVED : error.message };
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

// ---------- homework sets ----------

/** New set in the team's format with one fresh situation, then open it in the editor. */
export async function createSet(teamId: string) {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data: team } = await supabase.from("teams").select("format").eq("id", teamId).single();
  if (!team || !isFormatId(team.format)) return;
  const { data: set } = await supabase
    .from("scenario_sets")
    .insert({ team_id: teamId, name: "New homework", format: team.format })
    .select("id")
    .single();
  if (!set) return;
  const { data: sit } = await supabase
    .from("situations")
    .insert({ set_id: set.id, sort_order: 0, setup: defaultSetup(team.format) })
    .select("id")
    .single();
  if (sit) await supabase.from("situation_keys").insert({ situation_id: sit.id });
  redirect(`/coach/teams/${teamId}/sets/${set.id}`);
}

export type SaveSetInput = { name: string; situations: { id: string; setup: unknown; key: unknown }[] };

/**
 * Saves the whole set from the editor: name, situations in order, answer keys.
 * Situations missing from the list are deleted (with any answers to them).
 */
export async function saveSet(setId: string, input: SaveSetInput): Promise<FormState> {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data: set } = await supabase.from("scenario_sets").select("id, format").eq("id", setId).maybeSingle();
  if (!set || !isFormatId(set.format)) return { error: "This homework set no longer exists." };
  const f = FORMATS[set.format];

  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the homework set a name." };
  const items = (Array.isArray(input.situations) ? input.situations : []).slice(0, 50);
  if (!items.length) return { error: "A set needs at least one situation." };
  if (items.some((s) => typeof s.id !== "string" || !/^[0-9a-f-]{36}$/i.test(s.id))) return { error: "Something went wrong. Reload and try again." };

  const { error: nameError } = await supabase.from("scenario_sets").update({ name }).eq("id", setId);
  if (nameError) return { error: "Couldn't save. Please try again." };

  const keep = items.map((s) => s.id);
  const { data: existing } = await supabase.from("situations").select("id").eq("set_id", setId);
  const removed = (existing ?? []).map((s) => s.id).filter((id) => !keep.includes(id));
  if (removed.length) await supabase.from("situations").delete().in("id", removed);

  const { error: sitError } = await supabase
    .from("situations")
    .upsert(items.map((s, i) => ({ id: s.id, set_id: setId, sort_order: i, setup: cleanSetup(f, s.setup) })));
  if (sitError) return { error: "Couldn't save the situations. Please try again." };
  const { error: keyError } = await supabase
    .from("situation_keys")
    .upsert(items.map((s) => ({ situation_id: s.id, ...cleanKey(f, s.key) })));
  if (keyError) return { error: "Couldn't save the answer keys. Please try again." };

  refresh();
  return { message: "Saved." };
}

/** Publishing makes the set visible to the team's players. Every player needs an answer first. */
export async function setPublished(setId: string, published: boolean): Promise<FormState> {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  if (published) {
    const { data: set } = await supabase
      .from("scenario_sets")
      .select("format, situations (sort_order, situation_keys (model, note))")
      .eq("id", setId)
      .maybeSingle();
    if (!set || !isFormatId(set.format)) return { error: "This homework set no longer exists." };
    const f = FORMATS[set.format];
    const sits = ((set.situations ?? []) as { sort_order: number; situation_keys: unknown }[]).sort((a, b) => a.sort_order - b.sort_order);
    if (!sits.length) return { error: "Add at least one situation first." };
    const incomplete = sits
      .map((s, i) => ({ n: i + 1, missing: missingFromKey(f, cleanKey(f, Array.isArray(s.situation_keys) ? s.situation_keys[0] : s.situation_keys)) }))
      .filter((s) => s.missing.length);
    if (incomplete.length) {
      return { error: `Finish the answer key first: ${incomplete.map((s) => `situation ${s.n} (${s.missing.join(", ")})`).join("; ")}.` };
    }
  }
  const { error } = await supabase.from("scenario_sets").update({ published }).eq("id", setId);
  if (error) return { error: "Couldn't update. Please try again." };
  refresh();
  return { message: published ? "Published: your players can see it now." : "Hidden from players." };
}

export async function deleteSet(teamId: string, setId: string) {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  await supabase.from("scenario_sets").delete().eq("id", setId);
  redirect(`/coach/teams/${teamId}`);
}

// ---------- club admin ----------

/** Approves coach emails (one per line or comma-separated) so those people can sign up. */
export async function approveCoachEmails(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const emails = [...new Set(String(fd.get("emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) return { error: "Type at least one email address." };
  const bad = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.endsWith("@players.invalid"));
  if (bad) return { error: `"${bad}" doesn't look like an email address.` };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("approved_coach_emails").upsert(emails.map((email) => ({ email })), { onConflict: "email", ignoreDuplicates: true });
  if (error) return { error: "Couldn't save. Please try again." };
  refresh();
  return { message: `Approved ${emails.length} email${emails.length > 1 ? "s" : ""}. Those coaches can now sign up at /coach/sign-up.` };
}

export async function removeApprovedEmail(fd: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  await supabase.from("approved_coach_emails").delete().eq("email", text(fd, "email"));
  refresh();
}
