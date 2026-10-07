import "server-only";
import QRCode from "qrcode";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type InviteDetails = {
  playerId: string;
  nickname: string;
  /** set when this invite resets the PIN of a player who already joined */
  existingUserId: string | null;
  team: { name: string; joinCode: string };
};

/**
 * Looks up an invite for someone who isn't signed in yet, so it has to use the admin client.
 * Only ever called with a token from the URL: the 64-character token is the secret.
 */
export async function findInvite(token: string): Promise<InviteDetails | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("player_invites")
    .select("player_id, players (nickname, user_id, teams (name, join_code))")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const p = data.players as unknown as { nickname: string; user_id: string | null; teams: { name: string; join_code: string } };
  return { playerId: data.player_id, nickname: p.nickname, existingUserId: p.user_id, team: { name: p.teams.name, joinCode: p.teams.join_code } };
}

export const inviteUrl = (origin: string, token: string) => `${origin}/join/${token}`;

export const qrSvg = (url: string) => QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
