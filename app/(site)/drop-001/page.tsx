import type { Metadata } from "next";
import { EarlyAccessForm } from "@/components/lsw/early-access-form";
import { ProductCard } from "@/components/lsw/product-card";
import { products } from "@/lib/lsw";

export const metadata: Metadata = { title: "Drop 001", description: "The first LSW collection." };

const tiers = [
  { name: "Core", text: "Smaller logos, controlled detail. The pieces you wear most." },
  { name: "Signature", text: "Large back graphic with crystal detail. The statement." },
  { name: "Special Edition", text: "More elaborate embellishment in smaller runs. Only if the first drop proves demand." },
];

export default function Drop001Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">LSW</p>
      <h1 className="mt-2 text-5xl font-semibold uppercase tracking-tight sm:text-7xl">Drop 001</h1>
      <p className="mt-5 max-w-xl text-neutral-300">
        The first collection sets the identity: oversized, heavyweight, dark, with one clear statement per piece. No release date or quantity is announced yet. We&apos;ll publish both once they&apos;re real.
      </p>

      <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      <h2 className="mt-24 text-xs uppercase tracking-[0.3em] text-neutral-400">How the pieces are tiered</h2>
      <div className="mt-6 grid gap-px bg-white/10 sm:grid-cols-3">
        {tiers.map((t) => (
          <div className="bg-[#0a0a0b] p-6" key={t.name}>
            <h3 className="text-sm uppercase tracking-[0.2em]">{t.name}</h3>
            <p className="mt-3 text-sm text-neutral-400">{t.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-24 flex flex-col items-start gap-5 border-t border-white/10 pt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Hear first</h2>
        <EarlyAccessForm id="drop-signup" />
      </div>
    </div>
  );
}
