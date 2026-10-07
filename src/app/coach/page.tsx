import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateTeamForm } from "./forms";
import { CoachMenu } from "./CoachMenu";

export default function CoachHomePage() {
  return (
    <PageShell aside={<Suspense><CoachMenu /></Suspense>}>
      <Suspense fallback={<Loading what="Loading your teams" />}>
        <Teams />
      </Suspense>
    </PageShell>
  );
}

async function Teams() {
  const coach = await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, format, join_code, players (count)")
    .eq("coach_id", coach.id)
    .order("created_at");

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{coach.displayName ? `Hi ${coach.displayName}` : "Your teams"}</h1>
      {teams?.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {teams.map((t) => {
            const count = (t.players as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <Link key={t.id} href={`/coach/teams/${t.id}`} className="rounded-xl border border-line bg-panel p-4 hover:border-accent">
                <span className="block text-lg font-semibold">{t.name}</span>
                <span className="text-sm text-muted">{t.format} · {count} player{count === 1 ? "" : "s"} · team code {t.join_code}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mb-6 text-muted">You don&apos;t have a team yet. Create one to start inviting players.</p>
      )}
      <Card title={teams?.length ? "Add another team" : "Create your first team"} className="max-w-md">
        <CreateTeamForm />
      </Card>
    </>
  );
}
