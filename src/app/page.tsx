import { ButtonLink } from "@/components/ui";
import { PitchDemo } from "@/components/pitch/PitchDemo";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Pitch Positions</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Coaches build match situations. Players show where they would move, live with the team or as homework, and
        see the coach&apos;s answer straight away.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/play/login" variant="primary" className="px-5 py-2.5">Player login</ButtonLink>
        <ButtonLink href="/coach" className="px-5 py-2.5">Coach</ButtonLink>
      </div>

      <section className="mt-10">
        <PitchDemo />
      </section>
    </main>
  );
}
