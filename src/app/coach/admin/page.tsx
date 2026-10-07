import Link from "next/link";
import { Suspense } from "react";
import { Card, ConfirmSubmit } from "@/components/ui";
import { Loading, PageShell } from "@/components/PageShell";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { CoachMenu } from "../CoachMenu";
import { removeApprovedEmail } from "../actions";
import { ApproveEmailsForm } from "../forms";

export default function ClubAdminPage() {
  return (
    <PageShell aside={<Suspense><CoachMenu /></Suspense>}>
      <Link href="/coach" className="mb-3 inline-block text-sm text-accent underline">← Your teams</Link>
      <h1 className="mb-1 text-2xl font-bold">Club admin</h1>
      <p className="mb-5 text-muted">Only coaches whose email you approve here can create an account.</p>
      <Suspense fallback={<Loading what="Loading coaches" />}>
        <Coaches />
      </Suspense>
    </PageShell>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

async function Coaches() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const [{ data: coaches }, { data: approved }, { data: users }, { data: teams }] = await Promise.all([
    // The admin may read every coach profile (security rule "admin reads all coaches")
    supabase.from("coaches").select("id, display_name, is_admin, created_at").order("created_at"),
    supabase.from("approved_coach_emails").select("email, created_at").order("created_at"),
    // Emails live with the logins, and other coaches' teams are private to them,
    // so both come from the admin client (only after requireAdmin above)
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("teams").select("coach_id, name").order("created_at"),
  ]);
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const teamsOf = (coachId: string) => (teams ?? []).filter((t) => t.coach_id === coachId).map((t) => t.name).join(", ");
  const registered = new Set((coaches ?? []).map((c) => emailOf.get(c.id)?.toLowerCase()));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
      <Card title={`Coaches (${coaches?.length ?? 0})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 font-normal">Coach</th>
              <th className="font-normal">Teams</th>
              <th className="text-right font-normal">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(coaches ?? []).map((c) => (
              <tr key={c.id} className="border-t border-line align-top">
                <td className="py-2">
                  <span className="font-semibold">{c.display_name || "–"}</span>
                  {c.is_admin && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Admin</span>}
                  <span className="block text-muted">{emailOf.get(c.id)}</span>
                </td>
                <td className="py-2">{teamsOf(c.id) || <span className="text-muted">none</span>}</td>
                <td className="py-2 text-right text-muted">{day(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Approved coach emails">
        <ApproveEmailsForm />
        {approved?.length ? (
          <ul className="mt-4 divide-y divide-line text-sm">
            {approved.map((a) => (
              <li key={a.email} className="flex items-center gap-2 py-2">
                <span className="mr-auto break-all">{a.email}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${registered.has(a.email) ? "bg-good/15 text-good" : "bg-ok/15 text-ok"}`}>
                  {registered.has(a.email) ? "Signed up" : "Not yet"}
                </span>
                <form action={removeApprovedEmail}>
                  <input type="hidden" name="email" value={a.email} />
                  <ConfirmSubmit variant="danger" className="px-2 py-1 text-xs" message={`Remove ${a.email} from the approved list? (An account already created stays.)`}>
                    Remove
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No emails approved yet. Nobody else can sign up as a coach.</p>
        )}
      </Card>
    </div>
  );
}
