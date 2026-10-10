import Link from "next/link";
import { requireCoachAccount } from "@/lib/auth";
import { Button } from "@/components/ui";
import { signOut } from "./actions";

/** Header slot for coach pages: who's signed in + sign out. */
export async function CoachMenu() {
  // (also shown while a coach must replace a temporary password, so no redirect here)
  const coach = await requireCoachAccount();
  return (
    <form action={signOut} className="flex items-center gap-3">
      {coach.isAdmin && !coach.mustChangePassword && <Link href="/coach/admin" className="text-sm text-accent underline">Club admin</Link>}
      <Link href="/coach/account" className="text-sm text-muted hover:text-accent" title="Account and password">{coach.email}</Link>
      <Button type="submit">Sign out</Button>
    </form>
  );
}
