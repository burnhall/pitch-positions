import Link from "next/link";
import { Suspense } from "react";
import { Card, ConfirmSubmit, SubmitButton } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { Loading, PageShell } from "@/components/PageShell";
import { inviteUrl, qrSvg } from "@/lib/invites";
import { siteOrigin } from "@/lib/site";
import { AddPlayersForm } from "../../forms";
import { loadTeam } from "./data";
import { CoachMenu } from "../../CoachMenu";
import { newInvite, removePlayer } from "../../actions";

export default function TeamPage(props: PageProps<"/coach/teams/[teamId]">) {
  return (
    <PageShell aside={<Suspense><CoachMenu /></Suspense>}>
      <Link href="/coach" className="mb-3 inline-block text-sm text-accent underline print:hidden">← All teams</Link>
      <Suspense fallback={<Loading what="Loading team" />}>
        <Team params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Team({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, players } = await loadTeam(teamId);
  const origin = await siteOrigin();
  const waiting = players.filter((p) => p.token && !p.joined).length;

  return (
    <>
      <h1 className="text-2xl font-bold">{team.name}</h1>
      <p className="mb-5 text-muted">
        {team.format} · team code <b className="font-mono text-ink">{team.join_code}</b> (players use this to log in on a new device)
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <Card title={`Players (${players.length})`}>
          {players.length === 0 ? (
            <p className="text-muted">No players yet. Add their nicknames to create invites.</p>
          ) : (
            <ul className="divide-y divide-line">
              {await Promise.all(players.map(async (p) => {
                const url = p.token ? inviteUrl(origin, p.token) : null;
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-auto font-semibold">{p.nickname}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.joined ? "bg-good/15 text-good" : "bg-ok/15 text-ok"}`}>
                        {p.joined ? (p.token ? "Joined · PIN reset pending" : "Joined") : "Invite not used yet"}
                      </span>
                      {p.joined && !p.token && (
                        <form action={newInvite}>
                          <input type="hidden" name="playerId" value={p.id} />
                          <SubmitButton pending="…" className="text-sm">New invite (reset PIN)</SubmitButton>
                        </form>
                      )}
                      <form action={removePlayer}>
                        <input type="hidden" name="playerId" value={p.id} />
                        <ConfirmSubmit variant="danger" className="text-sm" message={`Remove ${p.nickname} from the team? Their answers and points will be deleted.`}>
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </div>
                    {url && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-accent">Show invite for {p.nickname}</summary>
                        <div className="mt-2 flex flex-wrap items-start gap-3">
                          <div className="w-28 rounded bg-white p-1" dangerouslySetInnerHTML={{ __html: await qrSvg(url) }} />
                          <div className="min-w-0 flex-1">
                            <p className="mb-2 break-all font-mono text-xs text-muted">{url}</p>
                            <CopyButton text={url} />
                            <p className="mt-2 text-xs text-muted">Send this to {p.nickname} (or a parent). It works once: opening it lets them choose a PIN.</p>
                          </div>
                        </div>
                      </details>
                    )}
                  </li>
                );
              }))}
            </ul>
          )}
          {waiting > 0 && (
            <p className="mt-3 text-sm">
              <Link href={`/coach/teams/${team.id}/invites`} className="text-accent underline">Print invite cards ({waiting})</Link>
              <span className="text-muted"> to hand out at training.</span>
            </p>
          )}
        </Card>

        <Card title="Add players">
          <AddPlayersForm teamId={team.id} />
        </Card>
      </div>
    </>
  );
}
