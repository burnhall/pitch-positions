import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { requireCoachAccount } from "@/lib/auth";
import { CoachMenu } from "../CoachMenu";
import { ChangePasswordForm } from "../forms";

export default function AccountPage() {
  return (
    <PageShell narrow aside={<Suspense><CoachMenu /></Suspense>}>
      <Suspense fallback={<Loading />}>
        <Account />
      </Suspense>
    </PageShell>
  );
}

async function Account() {
  const coach = await requireCoachAccount();
  return (
    <>
      {!coach.mustChangePassword && <Link href="/coach" className="mb-3 inline-block text-sm text-accent underline">← Your teams</Link>}
      <h1 className="mb-1 text-2xl font-bold">{coach.mustChangePassword ? "Choose a new password" : "Your account"}</h1>
      <p className="mb-4 text-muted">
        {coach.mustChangePassword
          ? "You signed in with a temporary password from your club admin. Choose your own password to continue."
          : <>Signed in as <b className="text-ink">{coach.email}</b>.</>}
      </p>
      <Card title={coach.mustChangePassword ? undefined : "Change password"}>
        <ChangePasswordForm required={coach.mustChangePassword} />
      </Card>
    </>
  );
}
