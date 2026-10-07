"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { claimInvite, playerLogin } from "./actions";

const PIN_INPUT = { type: "password", inputMode: "numeric", pattern: "[0-9]{4}", maxLength: 4, minLength: 4, required: true, autoComplete: "off" } as const;

export function ClaimInviteForm({ token, isReset }: { token: string; isReset: boolean }) {
  const [state, action] = useActionState(claimInvite.bind(null, token), null);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <Field label={isReset ? "Choose a new 4-number PIN" : "Choose a 4-number PIN"} hint="You'll need it if you log in on another phone or tablet.">
        <Input name="pin" {...PIN_INPUT} className="text-center text-2xl tracking-[0.5em]" />
      </Field>
      <Field label="Type it again">
        <Input name="pin2" {...PIN_INPUT} className="text-center text-2xl tracking-[0.5em]" />
      </Field>
      <SubmitButton variant="primary" className="w-full" pending="Joining…">{isReset ? "Save my new PIN" : "Join the team"}</SubmitButton>
    </form>
  );
}

export function PlayerLoginForm() {
  const [state, action] = useActionState(playerLogin, null);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <Field label="Team code" hint="Ask your coach if you don't know it.">
        <Input name="code" required autoCapitalize="characters" autoComplete="off" maxLength={8} className="font-mono uppercase" />
      </Field>
      <Field label="Your name on the team">
        <Input name="nickname" required autoComplete="off" maxLength={30} />
      </Field>
      <Field label="PIN">
        <Input name="pin" {...PIN_INPUT} className="text-center text-2xl tracking-[0.5em]" />
      </Field>
      <SubmitButton variant="primary" className="w-full" pending="Logging in…">Log in</SubmitButton>
    </form>
  );
}
