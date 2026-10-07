import Link from "next/link";
import { Suspense } from "react";
import { Button, Card } from "@/components/ui";
import { Leaderboard } from "@/components/Leaderboard";
import { Loading, PageShell } from "@/components/PageShell";
import { requirePlayer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { playerSignOut } from "./actions";

export default function PlayerHomePage(props: PageProps<"/play">) {
  return (
    <PageShell aside={<form action={playerSignOut}><Button type="submit">Log out</Button></form>}>
      <Suspense fallback={<Loading />}>
        <Home searchParams={props.searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/play">["searchParams"] }) {
  const [player, { welcome }] = await Promise.all([requirePlayer(), searchParams]);
  const supabase = await createSupabaseServerClient();
  // Security rules only return published sets of this player's team
  const [{ data: sets }, { data: answers }] = await Promise.all([
    supabase.from("scenario_sets").select("id, name, situations (id)").order("created_at", { ascending: false }),
    supabase.from("answers").select("situation_id, points").eq("player_id", player.id),
  ]);
  const pointsOf = new Map((answers ?? []).map((a) => [a.situation_id, a.points]));

  const homework = (sets ?? []).map((s) => {
    const ids = (s.situations as { id: string }[]).map((x) => x.id);
    const done = ids.filter((id) => pointsOf.has(id));
    return { id: s.id, name: s.name, total: ids.length, done: done.length, points: done.reduce((t, id) => t + pointsOf.get(id)!, 0) };
  }).filter((s) => s.total > 0);
  const todo = homework.filter((s) => s.done < s.total);
  const finished = homework.filter((s) => s.done === s.total);

  return (
    <>
      {welcome && (
        <p className="mb-4 rounded-lg bg-good/10 px-3 py-2 text-good">
          You&apos;re in! Next time on a new device, log in with team code <b className="font-mono">{player.team.joinCode}</b>, your name and your PIN.
        </p>
      )}
      <h1 className="text-2xl font-bold">Hi {player.nickname}!</h1>
      <p className="mb-5 text-muted">{player.team.name} · {player.team.format}</p>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Your homework">
          {homework.length === 0 && <p className="text-muted">No homework yet. Your coach&apos;s situations will appear here.</p>}
          {todo.length > 0 && (
            <ul className="space-y-2">
              {todo.map((s) => (
                <li key={s.id}>
                  <Link href={`/play/sets/${s.id}`} className="flex items-center gap-3 rounded-lg border border-accent bg-accent/10 p-3 hover:bg-accent/20">
                    <span className="mr-auto font-semibold">{s.name}</span>
                    <span className="text-sm text-muted">{s.done ? `${s.done} of ${s.total} done` : `${s.total} situation${s.total === 1 ? "" : "s"}`}</span>
                    <span className="font-semibold text-accent">{s.done ? "Continue ▶" : "Start ▶"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {finished.length > 0 && (
            <>
              <p className="mb-1 mt-4 text-sm text-muted">Finished</p>
              <ul className="divide-y divide-line">
                {finished.map((s) => (
                  <li key={s.id}>
                    <Link href={`/play/sets/${s.id}`} className="flex items-center gap-3 py-2 hover:text-accent">
                      <span className="mr-auto">✓ {s.name}</span>
                      <span className="text-sm text-muted">{s.points} points</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Leaderboard teamId={player.team.id} timezone={player.team.timezone} highlightPlayerId={player.id} />
      </div>
    </>
  );
}
