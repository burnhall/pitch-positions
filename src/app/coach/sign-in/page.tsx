import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { PageShell } from "@/components/PageShell";
import { SignInForm } from "../forms";

export default function CoachSignInPage(props: PageProps<"/coach/sign-in">) {
  return (
    <PageShell narrow>
      <h1 className="mb-4 text-2xl font-bold">Coach sign in</h1>
      <Suspense>
        <ConfirmedNote searchParams={props.searchParams} />
      </Suspense>
      <Card>
        <SignInForm />
      </Card>
      <p className="mt-4 text-sm text-muted">
        Forgot your password? Ask your club admin: they can give you a temporary one.
        <br />
        New coach? <Link href="/coach/sign-up" className="text-accent underline">Create an account</Link>
        <br />
        Are you a player? <Link href="/play/login" className="text-accent underline">Player login</Link>
      </p>
    </PageShell>
  );
}

async function ConfirmedNote({ searchParams }: { searchParams: PageProps<"/coach/sign-in">["searchParams"] }) {
  const { confirmed } = await searchParams;
  if (!confirmed) return null;
  return <p className="mb-3 rounded-lg bg-good/10 px-3 py-2 text-sm text-good">Your email is confirmed. Sign in to continue.</p>;
}
