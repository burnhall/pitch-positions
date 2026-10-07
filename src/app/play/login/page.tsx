import Link from "next/link";
import { Card } from "@/components/ui";
import { PageShell } from "@/components/PageShell";
import { PlayerLoginForm } from "../forms";

export default function PlayerLoginPage() {
  return (
    <PageShell narrow>
      <h1 className="mb-1 text-2xl font-bold">Player login</h1>
      <p className="mb-4 text-muted">First time? Open the invite your coach gave you instead.</p>
      <Card>
        <PlayerLoginForm />
      </Card>
      <p className="mt-4 text-sm text-muted">
        Forgot your PIN? Ask your coach for a new invite. Coach? <Link href="/coach/sign-in" className="text-accent underline">Coach sign in</Link>
      </p>
    </PageShell>
  );
}
