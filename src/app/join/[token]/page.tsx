import { Suspense } from "react";
import { Card } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { findInvite } from "@/lib/invites";
import { ClaimInviteForm } from "@/app/play/forms";

export default function JoinPage(props: PageProps<"/join/[token]">) {
  return (
    <PageShell narrow>
      <Suspense fallback={<Loading what="Opening your invite" />}>
        <Invite params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findInvite(token);
  if (!invite) {
    return (
      <Card title="This invite has already been used">
        <p className="text-muted">Each invite works once. If you already joined, log in with your team code, name and PIN. Otherwise, ask your coach for a new invite.</p>
        <a href="/play/login" className="mt-3 inline-block text-accent underline">Player login</a>
      </Card>
    );
  }
  const isReset = !!invite.existingUserId;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">{isReset ? `New PIN for ${invite.nickname}` : `Hi ${invite.nickname}!`}</h1>
      <p className="mb-4 text-muted">
        {isReset ? "Your coach sent you a new invite. Choose a new PIN." : <>You&apos;re joining <b className="text-ink">{invite.team.name}</b>.</>}
      </p>
      <Card>
        <ClaimInviteForm token={token} isReset={isReset} />
      </Card>
      <p className="mt-4 text-sm text-muted">
        Remember your team code <b className="font-mono text-ink">{invite.team.joinCode}</b>, your name <b className="text-ink">{invite.nickname}</b> and your PIN.
      </p>
    </>
  );
}
