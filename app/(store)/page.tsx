import Link from "next/link";
import type { CSSProperties } from "react";
import { Monogram, Wordmark } from "@/components/store/logo";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";
import { getStockMap } from "@/lib/commerce/stock";
import { GarmentArt } from "@/components/store/garment-art";
import { products } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default async function Home() {
  const stock = await getStockMap();
  const featured = products.slice(0, 3);
  return (
    <>
      {/* HERO */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: `${GRAIN}, radial-gradient(55% 60% at 72% 42%, #35363b 0%, #17181b 42%, #0a0a0b 78%)` }} />
        <div aria-hidden className="lsw-beam absolute -top-1/4 right-[8%] -z-10 h-[150%] w-[46%]" />
        <p aria-hidden className="lsw-outline display pointer-events-none absolute inset-x-0 -bottom-[0.14em] -z-10 select-none whitespace-nowrap text-center text-[19vw]">Drop 001</p>
        <div className="container-lsw grid min-h-[calc(100dvh-6.5rem)] items-center gap-8 py-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="lsw-reveal" style={{ "--d": "0ms" } as CSSProperties}><Wordmark className="h-14 w-auto sm:h-20" label="LSW" /></div>
            <h1 className="display mt-8 text-[clamp(2.4rem,6.2vw,5.75rem)]" id="hero-title">
              <span className="lsw-reveal block" style={{ "--d": "120ms" } as CSSProperties}>More than clothing.</span>
              <span className="lsw-reveal block text-silver" style={{ "--d": "240ms" } as CSSProperties}>It&apos;s a reminder.</span>
            </h1>
            <p className="lsw-reveal eyebrow mt-6 !text-silver" style={{ "--d": "380ms" } as CSSProperties}>Faith / Discipline / Purpose</p>
            <p className="lsw-reveal mt-6 max-w-md text-silver" style={{ "--d": "480ms" } as CSSProperties}>Oversized silhouettes. Original graphics. Selected crystal detail. DROP 001 is in development; fabric and fit are being confirmed in sampling.</p>
            <div className="lsw-reveal mt-10 flex flex-col gap-3 sm:flex-row" style={{ "--d": "600ms" } as CSSProperties}>
              <Link className="btn" href="/drop-001">Shop Drop 001</Link>
              <Link className="btn btn-ghost" href="#early-access">Join early access</Link>
            </div>
          </div>
          <figure className="lsw-reveal relative mx-auto w-full max-w-md lg:max-w-none" style={{ "--d": "250ms" } as CSSProperties}>
            <div className="lsw-float"><GarmentArt className="w-full" color="washed-black" garment="hoodie" level={2} view="back" /></div>
            <figcaption className="eyebrow mt-2 text-center">Concept render · Signature Hoodie · campaign photography pending</figcaption>
          </figure>
        </div>
        <a aria-label="Scroll to the drop" className="lsw-cue eyebrow absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 hover:text-bone lg:flex" href="#featured-title">
          Scroll<span aria-hidden className="lsw-cue-line" />
        </a>
      </section>

      {/* MARQUEE */}
      <div aria-hidden className="lsw-marquee overflow-hidden border-b border-line py-5 sm:py-7">
        <div className="lsw-marquee-track">
          {[0, 1].map((k) => (
            <span className="flex shrink-0 items-center" key={k}>
              {["Faith", "Discipline", "Purpose", "More than clothing", "Drop 001"].map((t, i) => (
                <span className="flex items-center" key={t}>
                  <span className={`display px-6 text-3xl sm:px-10 sm:text-5xl ${i % 2 ? "lsw-outline-strong" : ""}`}>{t}</span>
                  <Monogram className="h-5 w-5 sm:h-7 sm:w-7" mono />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURED DROP */}
      <section aria-labelledby="featured-title" className="container-lsw py-20 sm:py-28">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="display mt-3 text-4xl sm:text-6xl" id="featured-title" style={{ scrollMarginTop: "6rem" }}>Drop 001</h2>
          </div>
          <Link className="eyebrow underline underline-offset-4 hover:text-bone" href="/shop">View all</Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-3">
          {featured.map((p, i) => (
            <div className={i === 2 ? "col-span-2 mx-auto w-1/2 lg:col-span-1 lg:w-full" : ""} key={p.slug}><ProductCard product={p} stock={stock} /></div>
          ))}
        </div>
      </section>

      {/* BRAND STATEMENT */}
      <section className="border-y border-line bg-coal">
        <div className="container-lsw grid gap-10 py-20 sm:py-28 lg:grid-cols-[1fr_2fr]">
          <p className="eyebrow">What LSW stands for</p>
          <div>
            <p className="display text-3xl sm:text-5xl lg:text-6xl">Built around faith, discipline, and purpose.</p>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-silver">
              Every LSW piece is designed to be more than clothing — a reminder of who you are, what you stand for, and what you&apos;re working toward. Released in limited drops.
            </p>
            <Link className="eyebrow mt-8 inline-block underline underline-offset-4 hover:text-bone" href="/our-story">Read our story</Link>
          </div>
        </div>
      </section>

      {/* DETAIL CAMPAIGN */}
      <section aria-labelledby="detail-title" className="container-lsw py-20 sm:py-28">
        <p className="eyebrow">In the details</p>
        <h2 className="display mt-3 text-4xl sm:text-6xl" id="detail-title">Designed up close</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Crystal outline", note: "Cross graphic outlined in individually set stones.", view: "detail" as const },
            { label: "Interior label", note: "Woven neck label with DROP 001 limited-edition mark.", view: "label" as const },
            { label: "Heavyweight fleece", note: "Target 400–450 GSM — final spec confirmed at sampling.", view: "front" as const },
          ].map((d) => (
            <figure className="img-frame group" key={d.label}>
              <GarmentArt className="lsw-zoom aspect-[4/5] w-full" color="washed-black" garment="hoodie" level={2} view={d.view} />
              <figcaption className="border-t border-line p-4">
                <p className="eyebrow !text-bone">{d.label}</p>
                <p className="mt-1 text-sm text-steel">{d.note}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="eyebrow mt-4">Concept renders — detail photography will replace these after sampling.</p>
      </section>

      {/* EMAIL */}
      <section className="border-t border-line bg-coal" id="early-access">
        <div className="container-lsw grid gap-10 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Early access</p>
            <h2 className="display mt-3 text-4xl sm:text-6xl">Be first to know.</h2>
          </div>
          <div>
            <p className="max-w-md text-silver">Join the list and you&apos;ll get first notice when DROP 001 opens, product reveals as they&apos;re finished, and news of any early-access window once one is set. No spam — unsubscribe any time.</p>
            <div className="mt-6 max-w-md"><NewsletterForm /></div>
          </div>
        </div>
      </section>
    </>
  );
}
