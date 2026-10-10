"use client";

import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Field, FormMessage, Input, SubmitButton, inputClass } from "@/components/ui";
import { FORMAT_IDS } from "@/lib/pitch/formats";
import { addPlayers, approveCoachEmails, changePassword, createTeam, deleteTeam, resetCoachPassword, signInCoach, signUpCoach } from "./actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUpCoach, null);
  if (state?.message) return <FormMessage state={state} />;
  return (
    <form action={action}>
      <FormMessage state={state} />
      <Field label="Your name" hint="Players and parents will see this.">
        <Input name="name" autoComplete="name" required maxLength={60} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton variant="primary" className="w-full" pending="Creating your account…">Create coach account</SubmitButton>
    </form>
  );
}

export function SignInForm() {
  const [state, action] = useActionState(signInCoach, null);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton variant="primary" className="w-full" pending="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function CreateTeamForm() {
  const [state, action] = useActionState(createTeam, null);
  // The monthly leaderboard resets at midnight in the coach's own time zone
  // (read in the browser; the server render falls back to UTC)
  const timezone = useSyncExternalStore(noSubscribe, browserTimeZone, () => "UTC");
  return (
    <form action={action}>
      <FormMessage state={state} />
      <Field label="Team name">
        <Input name="name" required maxLength={60} placeholder="e.g. U10 Blue" />
      </Field>
      <Field label="Format">
        <select name="format" defaultValue="7v7" className={inputClass}>
          {FORMAT_IDS.map((f) => <option key={f}>{f}</option>)}
        </select>
      </Field>
      <input type="hidden" name="timezone" value={timezone} />
      <p className="mb-3 text-xs text-muted">The leaderboard resets at midnight on the 1st of each month ({timezone} time).</p>
      <SubmitButton variant="primary" pending="Creating…">Create team</SubmitButton>
    </form>
  );
}

export function AddPlayersForm({ teamId }: { teamId: string }) {
  const [state, action] = useActionState(addPlayers.bind(null, teamId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.message) form.current?.reset(); }, [state]);
  return (
    <form action={action} ref={form}>
      <FormMessage state={state} />
      <Field label="Nicknames, one per line" hint="Nicknames only: no surnames, emails or other personal details.">
        <textarea name="nicknames" rows={4} className={inputClass} placeholder={"Sara\nLeo\nMaya"} />
      </Field>
      <SubmitButton variant="primary" pending="Adding…">Add players</SubmitButton>
    </form>
  );
}

export function ApproveEmailsForm() {
  const [state, action] = useActionState(approveCoachEmails, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.message) form.current?.reset(); }, [state]);
  return (
    <form action={action} ref={form}>
      <FormMessage state={state} />
      <Field label="Coach emails, one per line" hint="They can then create their own account at the coach sign-up page.">
        <textarea name="emails" rows={3} className={inputClass} placeholder={"coach.one@example.com\ncoach.two@example.com"} />
      </Field>
      <SubmitButton variant="primary" pending="Saving…">Approve</SubmitButton>
    </form>
  );
}

export function ResetPasswordButton({ coachId, name }: { coachId: string; name: string }) {
  const [state, action] = useActionState(resetCoachPassword.bind(null, coachId), null);
  return (
    <form action={action} className="mt-1">
      {state?.password ? (
        <span className="block rounded-lg bg-good/10 p-2 text-xs">
          Temporary password for {name}: <b className="select-all font-mono text-sm text-ink">{state.password}</b>
          <span className="block text-muted">Give it to them privately. They&apos;ll choose a new password when they sign in. It won&apos;t be shown again.</span>
        </span>
      ) : (
        <>
          {state?.error && <span className="mb-1 block text-xs text-bad">{state.error}</span>}
          <SubmitButton className="px-2 py-1 text-xs" pending="Resetting…"
            onClick={(e) => { if (!confirm(`Reset ${name}'s password? Their current password stops working.`)) e.preventDefault(); }}>
            Reset password
          </SubmitButton>
        </>
      )}
    </form>
  );
}

export function ChangePasswordForm({ required }: { required: boolean }) {
  const [state, action] = useActionState(changePassword, null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.next) router.replace(state.next);
    else if (state?.message) form.current?.reset();
  }, [state, router]);
  return (
    <form action={action} ref={form}>
      <FormMessage state={state} />
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Type it again">
        <Input name="password2" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton variant="primary" pending="Saving…">{required ? "Save and continue" : "Change password"}</SubmitButton>
    </form>
  );
}

export function DeleteTeamForm({ teamId, teamName, players, sets }: { teamId: string; teamName: string; players: number; sets: number }) {
  const [state, action] = useActionState(deleteTeam.bind(null, teamId), null);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <p className="mb-3 text-sm text-muted">
        Deletes <b className="text-ink">{teamName}</b> for good: its {players} player{players === 1 ? "" : "s"} and their logins,
        {" "}{sets} homework set{sets === 1 ? "" : "s"}, and all answers and points. This can&apos;t be undone.
      </p>
      <Field label={`Type "${teamName}" to confirm`}>
        <Input name="confirm" autoComplete="off" required />
      </Field>
      <SubmitButton variant="danger" pending="Deleting…">Delete team</SubmitButton>
    </form>
  );
}
