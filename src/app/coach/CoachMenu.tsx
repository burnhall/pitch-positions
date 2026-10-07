import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { Button } from "@/components/ui";
import { signOut } from "./actions";

/** Header slot for coach pages: who's signed in + sign out. */
export async function CoachMenu() {
  const coach = await requireCoach();
  return (
    <form action={signOut} className="flex items-center gap-3">
      {coach.isAdmin && <Link href="/coach/admin" className="text-sm text-accent underline">Club admin</Link>}
      <span className="text-sm text-muted">{coach.email}</span>
      <Button type="submit">Sign out</Button>
    </form>
  );
}
