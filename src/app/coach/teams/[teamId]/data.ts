import "server-only";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PlayerRow = { id: string; nickname: string; user_id: string | null; player_invites: { token: string } | { token: string }[] | null };

/** The coach's team and its players with invite status. 404s for teams the coach doesn't own. */
export async function loadTeam(teamId: string) {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data: team } = await supabase.from("teams").select("id, name, format, join_code").eq("id", teamId).maybeSingle();
  if (!team) notFound();
  const { data } = await supabase
    .from("players")
    .select("id, nickname, user_id, player_invites (token)")
    .eq("team_id", teamId)
    .order("nickname");
  const players = ((data ?? []) as PlayerRow[]).map((p) => {
    const inv = Array.isArray(p.player_invites) ? p.player_invites[0] : p.player_invites;
    return { id: p.id, nickname: p.nickname, joined: !!p.user_id, token: inv?.token ?? null };
  });
  return { team, players };
}
