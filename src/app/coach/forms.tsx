"use client";

import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";
import { Field, FormMessage, Input, SubmitButton, inputClass } from "@/components/ui";
import { FORMAT_IDS } from "@/lib/pitch/formats";
import { addPlayers, createTeam, signInCoach, signUpCoach } from "./actions";

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
