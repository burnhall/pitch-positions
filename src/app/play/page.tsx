import { Suspense } from "react";
import { Button, Card } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { requirePlayer } from "@/lib/auth";
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
  return (
    <>
      {welcome && (
        <p className="mb-4 rounded-lg bg-good/10 px-3 py-2 text-good">
          You&apos;re in! Next time on a new device, log in with team code <b className="font-mono">{player.team.joinCode}</b>, your name and your PIN.
        </p>
      )}
      <h1 className="text-2xl font-bold">Hi {player.nickname}!</h1>
      <p className="mb-5 text-muted">{player.team.name} · {player.team.format}</p>
      <Card title="Your homework">
        <p className="text-muted">No homework yet. Your coach&apos;s situations will appear here.</p>
      </Card>
    </>
  );
}
