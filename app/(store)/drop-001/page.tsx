import type { Metadata } from "next";
import Link from "next/link";
import { GarmentArt } from "@/components/store/garment-art";
import { Monogram } from "@/components/store/logo";
import { ProductCard } from "@/components/store/product-card";
import { products } from "@/lib/catalog";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Drop 001", description: "LSW DROP 001 — the first limited collection." };

export default function DropPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <Monogram aria-hidden className="absolute -right-24 top-1/2 hidden h-[130%] -translate-y-1/2 opacity-[0.04] lg:block" mono />
        <div className="container-lsw py-20 sm:py-32">
          <p className="eyebrow">LSW</p>
          <h1 className="display mt-4 text-[clamp(3.5rem,14vw,11rem)]">Drop 001</h1>
          <p className="mt-6 max-w-xl text-lg text-silver">The first collection sets the standard: three focused pieces plus one concept, produced in limited quantity — not stocked endlessly.</p>
          <p className="eyebrow mt-6 !text-bone">
            {site.launchDate ? `Opens ${new Date(site.launchDate).toLocaleDateString("en-US", { dateStyle: "long" })}` : "Release date to be announced — join the early-access list"}
          </p>
          <Link className="btn mt-8" href="/#early-access">Join early access</Link>
        </div>
      </section>

      <section className="container-lsw py-20">
        <h2 className="display text-3xl sm:text-5xl">The pieces</h2>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      </section>

      <section className="border-t border-line bg-coal">
        <div className="container-lsw grid items-center gap-10 py-20 lg:grid-cols-2">
          <div>
            <h2 className="display text-3xl sm:text-5xl">Crystal, with restraint</h2>
            <p className="mt-6 text-silver">Clear and icy-white stones set into original cross and monogram graphics — placed to catch light without making the garment heavy, fragile, or uncomfortable.</p>
            <ul className="mt-8 space-y-4 border-t border-line pt-6 text-sm">
              {[["Level 1 · Core", "Restrained branding. Embroidery and print. Tee, beanie."], ["Level 2 · Signature", "Crystal-outlined graphics. Signature Hoodie."], ["Level 3 · Special Edition", "Fuller crystal work, in small runs. Concept stage."]].map(([t, d]) => (
                <li className="flex flex-col gap-1 sm:flex-row sm:gap-6" key={t}><span className="eyebrow w-48 shrink-0 !text-bone">{t}</span><span className="text-steel">{d}</span></li>
              ))}
            </ul>
          </div>
          <div className="img-frame"><GarmentArt className="w-full" color="charcoal" garment="hoodie" level={2} view="back" /></div>
        </div>
      </section>
    </>
  );
}
