import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { requirePlayer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FORMATS, isFormatId } from "@/lib/pitch/formats";
import { cleanKey, cleanPositions, cleanSetup } from "@/lib/pitch/validate";
import { playerSignOut } from "../../actions";
import { HomeworkRunner, type Result } from "./HomeworkRunner";

export default function HomeworkPage(props: PageProps<"/play/sets/[setId]">) {
  return (
    <PageShell aside={<form action={playerSignOut}><Button type="submit">Log out</Button></form>}>
      <Suspense fallback={<Loading what="Opening homework" />}>
        <Homework params={props.params} />
      </Suspense>
    </PageShell>
  );
}

type AnswerRow = { situation_id: string; positions: unknown; points: number; max_points: number };
type KeyRow = { situation_id: string; model: unknown; note: string };

async function Homework({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const player = await requirePlayer();
  const supabase = await createSupabaseServerClient();
  // Security rules: only published sets of the player's own team come back
  const { data: set } = await supabase
    .from("scenario_sets")
    .select("id, name, format, situations (id, sort_order, setup)")
    .eq("id", setId)
    .maybeSingle();
  if (!set || !isFormatId(set.format)) notFound();
  const f = FORMATS[set.format];
  const sits = ((set.situations ?? []) as { id: string; sort_order: number; setup: unknown }[]).sort((a, b) => a.sort_order - b.sort_order);
  if (!sits.length) notFound();
  const ids = sits.map((s) => s.id);

  // Own answers, plus the answer keys the rules now allow this player to read
  const [{ data: answers }, { data: keys }] = await Promise.all([
    supabase.from("answers").select("situation_id, positions, points, max_points").eq("player_id", player.id).in("situation_id", ids),
    supabase.from("situation_keys").select("situation_id, model, note").in("situation_id", ids),
  ]);
  const answerOf = new Map(((answers ?? []) as AnswerRow[]).map((a) => [a.situation_id, a]));
  const keyOf = new Map(((keys ?? []) as KeyRow[]).map((k) => [k.situation_id, k]));

  const situations = sits.map((s) => {
    const a = answerOf.get(s.id);
    const result: Result | null = a
      ? { points: a.points, maxPoints: a.max_points, positions: cleanPositions(f, a.positions), key: cleanKey(f, keyOf.get(s.id)) }
      : null;
    return { id: s.id, setup: cleanSetup(f, s.setup), result };
  });

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{set.name}</h1>
      <HomeworkRunner set={{ name: set.name, format: set.format }} situations={situations} />
    </>
  );
}
