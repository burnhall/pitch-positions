import Link from "next/link";
import type { ReactNode } from "react";

/** Page frame: app name linking home, an optional right-hand slot, then the content. */
export function PageShell({ children, aside, narrow }: { children: ReactNode; aside?: ReactNode; narrow?: boolean }) {
  return (
    <>
      <header className="border-b border-line bg-panel print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="mr-auto text-lg font-bold">Pitch Positions</Link>
          {aside}
        </div>
      </header>
      <main className={`mx-auto w-full px-4 py-6 ${narrow ? "max-w-md" : "max-w-5xl"}`}>{children}</main>
    </>
  );
}

export const Loading = ({ what = "Loading" }: { what?: string }) => <p className="text-muted">{what}…</p>;
