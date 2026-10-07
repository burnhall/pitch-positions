import Link from "next/link";
import { Card } from "@/components/ui";
import { PageShell } from "@/components/PageShell";
import { SignUpForm } from "../forms";

export default function CoachSignUpPage() {
  return (
    <PageShell narrow>
      <h1 className="mb-1 text-2xl font-bold">Create a coach account</h1>
      <p className="mb-4 text-muted">Set up your team, then invite your players.</p>
      <Card>
        <SignUpForm />
      </Card>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link href="/coach/sign-in" className="text-accent underline">Sign in</Link>
      </p>
    </PageShell>
  );
}
