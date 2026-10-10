import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading, PageShell } from "@/components/PageShell";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FORMATS, isFormatId } from "@/lib/pitch/formats";
import { cleanKey, cleanPositions, cleanSetup, completeKey } from "@/lib/pitch/validate";
import type { Situation } from "@/lib/pitch/situation";
import { CoachMenu } from "../../../../../CoachMenu";
import { ReviewBoard, type ReviewAnswer } from "./ReviewBoard";

export default function ReviewPage(props: PageProps<"/coach/teams/[teamId]/sets/[setId]/review">) {
  return (
    <PageShell aside={<Suspense><CoachMenu /></Suspense>}>
      <Suspense fallback={<Loading what="Loading answers" />}>
        <Review params={props.params} />
      </Suspense>
    </PageShell>
  );
}

type SitRow = { id: string; sort_order: number; setup: unknown; situation_keys: unknown };
type AnswerRow = { situation_id: string; positions: unknown; points: number; max_points: number; players: { id: string; nickname: string } };

async function Review({ params }: { params: Promise<{ teamId: string; setId: string }> }) {
  const { teamId, setId } = await params;
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data: set } = await supabase
    .from("scenario_sets")
    .select("id, name, format, situations (id, sort_order, setup, situation_keys (model, note))")
    .eq("id", setId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!set || !isFormatId(set.format)) notFound();
  const f = FORMATS[set.format];

  const situations: Situation[] = ((set.situations ?? []) as SitRow[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => {
      const setup = cleanSetup(f, s.setup);
      return { id: s.id, setup, key: completeKey(f, setup, cleanKey(f, Array.isArray(s.situation_keys) ? s.situation_keys[0] : s.situation_keys)) };
    });
  if (!situations.length) notFound();

  const { data } = await supabase
    .from("answers")
    .select("situation_id, positions, points, max_points, players (id, nickname)")
    .in("situation_id", situations.map((s) => s.id));
  const answers: ReviewAnswer[] = ((data ?? []) as unknown as AnswerRow[]).map((a) => ({
    playerId: a.players.id, nickname: a.players.nickname, situationId: a.situation_id,
    positions: cleanPositions(f, a.positions), points: a.points, maxPoints: a.max_points,
  }));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link href={`/coach/teams/${teamId}/sets/${setId}`} className="text-sm text-accent underline">← Edit set</Link>
        <h1 className="text-2xl font-bold">Review: {set.name}</h1>
      </div>
      <ReviewBoard format={set.format} situations={situations} answers={answers} />
    </>
  );
}
