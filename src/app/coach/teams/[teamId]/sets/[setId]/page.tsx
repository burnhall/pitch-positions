import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FORMATS, isFormatId } from "@/lib/pitch/formats";
import { pct } from "@/lib/pitch/scoring";
import { cleanKey, cleanSetup } from "@/lib/pitch/validate";
import type { Situation } from "@/lib/pitch/situation";
import { CoachMenu } from "../../../../CoachMenu";
import { SetEditor } from "./SetEditor";

export default function SetPage(props: PageProps<"/coach/teams/[teamId]/sets/[setId]">) {
  return (
    <PageShell aside={<Suspense><CoachMenu /></Suspense>}>
      <Suspense fallback={<Loading what="Loading homework set" />}>
        <SetContent params={props.params} />
      </Suspense>
    </PageShell>
  );
}

type SitRow = { id: string; sort_order: number; setup: unknown; situation_keys: unknown };
type AnswerRow = { situation_id: string; points: number; max_points: number; players: { id: string; nickname: string } };

async function SetContent({ params }: { params: Promise<{ teamId: string; setId: string }> }) {
  const { teamId, setId } = await params;
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data: set } = await supabase
    .from("scenario_sets")
    .select("id, team_id, name, format, published, teams (name), situations (id, sort_order, setup, situation_keys (model, note))")
    .eq("id", setId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!set || !isFormatId(set.format)) notFound();
  const f = FORMATS[set.format];
  const team = set.teams as unknown as { name: string };

  const situations: Situation[] = ((set.situations ?? []) as SitRow[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ id: s.id, setup: cleanSetup(f, s.setup), key: cleanKey(f, Array.isArray(s.situation_keys) ? s.situation_keys[0] : s.situation_keys) }));

  const ids = situations.map((s) => s.id);
  const { data: answers } = ids.length
    ? await supabase.from("answers").select("situation_id, points, max_points, players (id, nickname)").in("situation_id", ids)
    : { data: [] };
  const rows = (answers ?? []) as unknown as AnswerRow[];

  const answerCounts: Record<string, number> = {};
  const byKid = new Map<string, { nickname: string; done: number; points: number; max: number }>();
  for (const a of rows) {
    answerCounts[a.situation_id] = (answerCounts[a.situation_id] ?? 0) + 1;
    const k = byKid.get(a.players.id) ?? { nickname: a.players.nickname, done: 0, points: 0, max: 0 };
    k.done++;
    k.points += a.points;
    k.max += a.max_points;
    byKid.set(a.players.id, k);
  }
  const kids = [...byKid.values()].sort((a, b) => b.points - a.points);

  return (
    <>
      <Link href={`/coach/teams/${teamId}`} className="mb-3 inline-block text-sm text-accent underline">← {team.name}</Link>
      <SetEditor teamId={teamId} set={{ id: set.id, name: set.name, format: set.format, published: set.published }} initial={situations} answerCounts={answerCounts} />

      <Card title={`Results so far (${kids.length} player${kids.length === 1 ? "" : "s"})`} className="mt-4">
        {kids.length === 0 ? (
          <p className="text-muted">{set.published ? "Nobody has started this set yet." : "Publish the set so your players can start."}</p>
        ) : (
          <>
          <Link href={`/coach/teams/${teamId}/sets/${setId}/review`} className="mb-3 inline-block rounded-lg border border-accent bg-accent px-3.5 py-2 font-semibold text-accent-ink">
            Review answers on the pitch ▶
          </Link>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1.5 font-normal">Player</th><th className="font-normal">Situations</th><th className="text-right font-normal">Accuracy</th><th className="text-right font-normal">Points</th></tr></thead>
            <tbody>
              {kids.map((k) => (
                <tr key={k.nickname} className="border-t border-line">
                  <td className="py-1.5">{k.nickname}</td>
                  <td>{k.done} / {situations.length}</td>
                  <td className="text-right">{pct(k.points, k.max) ?? "–"}%</td>
                  <td className="text-right font-semibold">{k.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </Card>
    </>
  );
}
