export function PolicyPage({ title, sections }: { title: string; sections: { h: string; p: string }[] }) {
  return (
    <div className="container-lsw max-w-3xl py-16 sm:py-24">
      <p className="eyebrow">Draft — not final</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">{title}</h1>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section className="border-t border-line pt-6" key={s.h}>
            <h2 className="eyebrow !text-bone">{s.h}</h2>
            <p className="mt-3 leading-relaxed text-silver">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
