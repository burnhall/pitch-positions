"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 ${className}`}>
      {title && <h2 className="mb-3 text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

const buttonStyles = {
  primary: "border-accent bg-accent font-semibold text-accent-ink",
  secondary: "border-line bg-chip hover:border-accent",
  danger: "border-line bg-chip text-bad hover:border-bad",
};

type ButtonVariant = keyof typeof buttonStyles;

export function Button({ variant = "secondary", className = "", ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button {...props} className={`rounded-lg border px-3.5 py-2 disabled:cursor-default disabled:opacity-50 ${buttonStyles[variant]} ${className}`} />
  );
}

export function ButtonLink({ variant = "secondary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={`inline-block rounded-lg border px-3.5 py-2 ${buttonStyles[variant]} ${className}`} />;
}

/** Submit button that disables itself and shows `pending` text while the form is being sent. */
export function SubmitButton({ children, pending: pendingText, ...props }: ComponentProps<typeof Button> & { pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/** Submit button that asks for confirmation first (for removing things). */
export function ConfirmSubmit({ message, ...props }: ComponentProps<typeof SubmitButton> & { message: string }) {
  return <SubmitButton {...props} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = "w-full rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-accent";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function FormMessage({ state }: { state?: { error?: string; message?: string } | null }) {
  if (state?.error) return <p role="alert" className="mb-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>;
  if (state?.message) return <p role="status" className="mb-3 rounded-lg bg-good/10 px-3 py-2 text-sm text-good">{state.message}</p>;
  return null;
}
