import Link from "next/link";
import { Suspense } from "react";
import { Loading } from "@/components/PageShell";
import { inviteUrl, qrSvg } from "@/lib/invites";
import { siteOrigin } from "@/lib/site";
import { PIN_LENGTH } from "@/lib/players";
import { loadTeam } from "../data";
import { PrintButton } from "./PrintButton";

/** Printable invite cards for every player who hasn't joined yet (or has a PIN reset waiting). */
export default function InviteCardsPage(props: PageProps<"/coach/teams/[teamId]/invites">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 print:p-0">
      <Suspense fallback={<Loading what="Preparing invite cards" />}>
        <Cards params={props.params} />
      </Suspense>
    </main>
  );
}

async function Cards({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, players } = await loadTeam(teamId);
  const origin = await siteOrigin();
  const cards = await Promise.all(
    players.filter((p) => p.token).map(async (p) => ({ ...p, qr: await qrSvg(inviteUrl(origin, p.token!)) })),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/coach/teams/${team.id}`} className="mr-auto text-sm text-accent underline">← Back to {team.name}</Link>
        <PrintButton />
      </div>
      {cards.length === 0 && <p className="text-muted">Every player has joined. Nothing to print.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {cards.map((c) => (
          <div key={c.id} className="flex gap-4 rounded-xl border-2 border-dashed border-line bg-white p-4 text-black break-inside-avoid">
            <div className="w-32 shrink-0" dangerouslySetInnerHTML={{ __html: c.qr }} />
            <div className="min-w-0 text-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">Pitch Positions · {team.name}</p>
              <p className="my-1 text-2xl font-bold">{c.nickname}</p>
              <ol className="list-decimal pl-4 text-gray-700">
                <li>Scan the code with a phone or tablet.</li>
                <li>Choose a {PIN_LENGTH}-number PIN you&apos;ll remember.</li>
              </ol>
              <p className="mt-2 text-gray-700">Team code: <b className="font-mono">{team.join_code}</b></p>
              <p className="text-xs text-gray-500">This card works once. Keep your PIN secret.</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
