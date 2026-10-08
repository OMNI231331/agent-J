import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/store/logo";

export const metadata: Metadata = { title: "Our Story", description: "What LSW stands for: faith, discipline, and purpose." };

const pillars = [
  { n: "01", t: "Faith", d: "The foundation. LSW carries a faith-centered meaning, expressed through design that anyone who connects with the message can wear — fashion first, never a costume or a sermon." },
  { n: "02", t: "Discipline", d: "Showing up on the unglamorous days. It's why we make fewer things, finish them properly, and don't release anything we wouldn't wear." },
  { n: "03", t: "Purpose", d: "Knowing what you're building toward. The clothes are a reminder to keep moving in that direction." },
];

export default function StoryPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <Monogram aria-hidden className="absolute -right-24 top-1/2 hidden h-[130%] -translate-y-1/2 opacity-[0.04] lg:block" mono />
        <div className="container-lsw py-20 sm:py-32">
          <p className="eyebrow">Our story</p>
          <h1 className="display mt-4 max-w-4xl text-[clamp(2.6rem,8vw,6.5rem)]">More than clothing. It&apos;s a reminder.</h1>
        </div>
      </section>
      <section className="container-lsw grid gap-12 py-20 lg:grid-cols-[1fr_2fr]">
        <p className="eyebrow">Why LSW exists</p>
        <div className="max-w-2xl space-y-6 text-lg leading-relaxed text-silver">
          <p>LSW is a streetwear label built around three words: faith, discipline, and purpose.</p>
          <p>We wanted clothing that looks like it belongs in the dark editorial world of modern streetwear — oversized, heavyweight, detailed — but that carries a message worth wearing. Not a slogan on every sleeve. A signal you notice up close.</p>
          <p>Every piece is meant to be a reminder: who you are, what you stand for, and what you&apos;re working toward.</p>
        </div>
      </section>
      <section className="border-y border-line bg-coal">
        <div className="container-lsw grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {pillars.map((p) => (
            <div className="py-12 md:px-8 md:first:pl-0 md:last:pr-0" key={p.n}>
              <p className="eyebrow">{p.n}</p>
              <h2 className="display mt-4 text-4xl">{p.t}</h2>
              <p className="mt-4 text-steel">{p.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container-lsw grid gap-12 py-20 lg:grid-cols-[1fr_2fr]">
        <p className="eyebrow">How we design</p>
        <div className="max-w-2xl space-y-6 text-lg leading-relaxed text-silver">
          <p>Silhouette first: oversized, dropped-shoulder fits cut from heavyweight fabric. Then restraint — a small controlled mark on the front, the statement on the back.</p>
          <p>Graphics are original: a spiked cross and a gothic-inspired wordmark, drawn for LSW. Crystal detailing is used where it earns its place, and kept off anything it would make uncomfortable or fragile.</p>
        </div>
      </section>
      <section className="border-t border-line bg-coal">
        <div className="container-lsw grid gap-12 py-20 lg:grid-cols-[1fr_2fr]">
          <p className="eyebrow">Why limited</p>
          <div className="max-w-2xl space-y-6 text-lg leading-relaxed text-silver">
            <p>We release in drops. Small, deliberate runs let us control quality and avoid piling up inventory nobody asked for. When a drop is gone, it may not return.</p>
            <p>If a piece is ever numbered, the number will correspond to a real, tracked production run.</p>
            <Link className="btn mt-4" href="/drop-001">See Drop 001</Link>
          </div>
        </div>
      </section>
    </>
  );
}
