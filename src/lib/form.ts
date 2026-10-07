/** What a form's Server Action returns: an error to show, or a success message. */
export type FormState = { error?: string; message?: string } | null;

export const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();
