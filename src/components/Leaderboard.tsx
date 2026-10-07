import { Card } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pct } from "@/lib/pitch/scoring";

type Row = { player_id: string; nickname: string; situations: number; points: number; max_points: number };

const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? String(i + 1);

/** This month's team leaderboard (resets on the 1st in the team's time zone). */
export async function Leaderboard({ teamId, timezone, highlightPlayerId }: { teamId: string; timezone: string; highlightPlayerId?: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("team_leaderboard", { p_team: teamId });
  const rows = (data ?? []) as Row[];
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: timezone }).format(new Date());

  return (
    <Card title={`Leaderboard · ${month}`}>
      {rows.length === 0 ? (
        <p className="text-muted">No homework done yet this month. Be the first!</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="w-8 py-1.5 font-normal" aria-label="Rank" />
              <th className="font-normal">Player</th>
              <th className="text-right font-normal">Situations</th>
              <th className="text-right font-normal">Accuracy</th>
              <th className="text-right font-normal">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player_id} className={`border-t border-line ${r.player_id === highlightPlayerId ? "font-bold" : ""}`}>
                <td className="py-1.5">{medal(i)}</td>
                <td>{r.nickname}{r.player_id === highlightPlayerId ? " (you)" : ""}</td>
                <td className="text-right">{r.situations}</td>
                <td className="text-right">{pct(r.points, r.max_points) ?? "–"}%</td>
                <td className="text-right">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs text-muted">Points add up across all homework. A new leaderboard starts on the 1st of every month.</p>
    </Card>
  );
}
