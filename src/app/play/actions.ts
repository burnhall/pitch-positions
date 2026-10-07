"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { findInvite } from "@/lib/invites";
import {
  LOCK_MINUTES, MAX_PIN_FAILURES, PIN_LENGTH, isValidPin, normalizeJoinCode, normalizeNickname, pinPassword, playerEmail,
} from "@/lib/players";
import { text, type FormState } from "@/lib/form";

/** A kid opens their invite link and picks a PIN. Creates their login (or resets the PIN) and signs them in. */
export async function claimInvite(token: string, _: FormState, fd: FormData): Promise<FormState> {
  const pin = text(fd, "pin");
  if (!isValidPin(pin)) return { error: `Your PIN must be ${PIN_LENGTH} numbers.` };
  if (pin !== text(fd, "pin2")) return { error: "The two PINs don't match. Try again." };

  const invite = await findInvite(token);
  if (!invite) return { error: "This invite has already been used. Ask your coach for a new one." };

  const admin = createSupabaseAdminClient();
  const email = playerEmail(invite.playerId);
  const password = pinPassword(invite.playerId, pin);

  if (invite.existingUserId) {
    const { error } = await admin.auth.admin.updateUserById(invite.existingUserId, { password, app_metadata: { role: "player", pin_failures: 0, locked_until: null } });
    if (error) return { error: "Something went wrong. Please try again." };
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: "player" }, user_metadata: { nickname: invite.nickname },
    });
    if (error || !data.user) return { error: "Something went wrong. Please try again." };
    const { error: linkError } = await admin.from("players").update({ user_id: data.user.id }).eq("id", invite.playerId).is("user_id", null);
    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { error: "Something went wrong. Please try again." };
    }
  }
  await admin.from("player_invites").delete().eq("token", token);

  // Sign in on this device (replaces whoever was signed in here before)
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/play/login");
  redirect("/play?welcome=1");
}

const WRONG = "That team code, name or PIN isn't right.";

/** Team code + nickname + PIN, with a short lockout after repeated wrong PINs. */
export async function playerLogin(_: FormState, fd: FormData): Promise<FormState> {
  const joinCode = normalizeJoinCode(text(fd, "code"));
  const nickname = normalizeNickname(text(fd, "nickname")).toLowerCase();
  const pin = text(fd, "pin");
  if (!joinCode || !nickname || !isValidPin(pin)) return { error: WRONG };

  const admin = createSupabaseAdminClient();
  const { data: team } = await admin.from("teams").select("id").eq("join_code", joinCode).maybeSingle();
  if (!team) return { error: WRONG };
  const { data: players } = await admin.from("players").select("id, nickname, user_id").eq("team_id", team.id).not("user_id", "is", null);
  const player = players?.find((p) => p.nickname.toLowerCase() === nickname);
  if (!player?.user_id) return { error: WRONG };

  const { data: u } = await admin.auth.admin.getUserById(player.user_id);
  const meta = (u.user?.app_metadata ?? {}) as { pin_failures?: number; locked_until?: string | null };
  if (meta.locked_until && new Date(meta.locked_until) > new Date()) {
    return { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes, or ask your coach for a new invite.` };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: playerEmail(player.id), password: pinPassword(player.id, pin) });
  if (error) {
    const failures = (meta.pin_failures ?? 0) + 1;
    const locked = failures >= MAX_PIN_FAILURES;
    await admin.auth.admin.updateUserById(player.user_id, {
      app_metadata: { pin_failures: locked ? 0 : failures, locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null },
    });
    return { error: locked ? `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` : WRONG };
  }
  if (meta.pin_failures || meta.locked_until) {
    await admin.auth.admin.updateUserById(player.user_id, { app_metadata: { pin_failures: 0, locked_until: null } });
  }
  redirect("/play");
}

export async function playerSignOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/play/login");
}
