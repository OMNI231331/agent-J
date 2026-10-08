import type { CSSProperties } from "react";
import Link from "next/link";
import { Cross, Wordmark } from "@/components/lsw/logo";
import { EarlyAccessForm } from "@/components/lsw/early-access-form";
import { ProductArt } from "@/components/lsw/product-art";
import { ProductCard } from "@/components/lsw/product-card";
import { brand, colors, products } from "@/lib/lsw";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#2a2a2f_0%,#0a0a0b_60%)]" />
        <Cross className="absolute -right-10 top-1/2 hidden h-[70%] -translate-y-1/2 opacity-[0.07] md:block" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6">
          <div className="lsw-rise" style={{ "--d": "60ms" } as CSSProperties}>
            <Wordmark className="w-64 sm:w-96" />
          </div>
          <h1 className="lsw-rise mt-8 max-w-2xl text-4xl font-semibold uppercase leading-[1.05] tracking-tight sm:text-6xl">
            More than clothing.
            <br />
            It&apos;s a reminder.
          </h1>
          <p className="lsw-rise mt-6 text-xs uppercase tracking-[0.4em] text-neutral-400" style={{ "--d": "260ms" } as CSSProperties}>{brand.pillars.join(" / ")}</p>
          <div className="lsw-rise mt-10 flex flex-wrap gap-3" style={{ "--d": "380ms" } as CSSProperties}>
            <Link className="bg-neutral-100 px-7 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-black hover:bg-white" href="/drop-001">
              Shop Drop 001
            </Link>
            <a className="border border-white/30 px-7 py-4 text-xs font-semibold uppercase tracking-[0.25em] hover:border-white" href="#early-access">
              Join early access
            </a>
          </div>
          <p className="mt-8 text-[11px] text-neutral-400">Campaign photography is in production. Images on this site are concept mockups.</p>
        </div>
      </section>

      <section className="lsw-reveal mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Drop 001</h2>
          <Link className="text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-white" href="/shop">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#070708]">
        <div className="lsw-reveal mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.4em] text-neutral-400">The idea</p>
          <p className="mt-6 text-2xl leading-snug sm:text-3xl">
            LSW is built around faith, discipline and purpose. Every collection is designed to be more than clothing: a reminder of who you are and what you&apos;re working toward.
          </p>
          <Link className="mt-8 inline-block border-b border-neutral-400 pb-0.5 text-xs uppercase tracking-[0.25em] text-neutral-300" href="/about">
            Our story
          </Link>
        </div>
      </section>

      <section className="lsw-reveal mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">In the details</h2>
        <p className="mt-2 max-w-xl text-sm text-neutral-400">The back graphic is the statement. Crystals are used where they count, not everywhere.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <ProductArt className="aspect-[5/6] w-full border border-white/10" color={colors["washed-black"].hex} kind="hoodie" view="detail" />
          <ProductArt className="aspect-[5/6] w-full border border-white/10" color={colors.charcoal.hex} kind="hoodie" view="back" />
          <ProductArt className="aspect-[5/6] w-full border border-white/10" color={colors["washed-gray"].hex} kind="tee" view="back" />
        </div>
      </section>

      <section className="border-t border-white/10" id="early-access-wrap">
        <div className="lsw-reveal mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Get early access to Drop 001</h2>
          <p className="max-w-lg text-sm text-neutral-400">Join the list to hear first when the collection opens, and to see how it&apos;s made.</p>
          <EarlyAccessForm />
        </div>
      </section>
    </>
  );
}
