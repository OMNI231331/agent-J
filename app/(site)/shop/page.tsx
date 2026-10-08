import type { Metadata } from "next";
import { CheckoutNotice } from "@/components/lsw/checkout-notice";
import { ProductCard } from "@/components/lsw/product-card";
import { products } from "@/lib/lsw";

export const metadata: Metadata = { title: "Shop", description: "LSW Drop 001: heavyweight oversized streetwear." };

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <CheckoutNotice />
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Drop 001</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Shop</h1>
      <p className="mt-3 max-w-xl text-sm text-neutral-400">
        Three pieces, designed to work together. Prices are drafts and nothing is on sale until the first samples are approved.
      </p>
      <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
