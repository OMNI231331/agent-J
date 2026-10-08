import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { products, type Category } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop", description: "Shop LSW DROP 001 — heavyweight hoodies, oversized tees and headwear." };

const categories: ("All" | Category)[] = ["All", "Hoodies", "Tees", "Headwear"];
const sorts = { featured: "Featured", "price-asc": "Price: low to high", "price-desc": "Price: high to low" } as const;

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string }> }) {
  const sp = await searchParams;
  const category = categories.find((c) => c === sp.category) ?? "All";
  const sort = (Object.keys(sorts) as (keyof typeof sorts)[]).find((s) => s === sp.sort) ?? "featured";
  const list = products
    .filter((p) => category === "All" || p.category === category)
    .sort((a, b) => (sort === "price-asc" ? a.priceCents - b.priceCents : sort === "price-desc" ? b.priceCents - a.priceCents : 0));
  const href = (c: string, s: string) => `/shop?${new URLSearchParams({ ...(c !== "All" && { category: c }), ...(s !== "featured" && { sort: s }) })}`;

  return (
    <div className="container-lsw pt-12 pb-24 sm:pt-16">
      <p className="eyebrow">LSW — Drop 001</p>
      <h1 className="display mt-3 text-5xl sm:text-7xl">Shop</h1>
      <div className="mt-10 flex flex-col gap-5 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link aria-current={c === category ? "true" : undefined} className={`eyebrow border px-3 py-2 ${c === category ? "border-bone !text-bone" : "border-line hover:border-silver"}`} href={href(c, sort)} key={c}>{c}</Link>
          ))}
        </nav>
        <nav aria-label="Sort" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {(Object.keys(sorts) as (keyof typeof sorts)[]).map((s) => (
            <Link aria-current={s === sort ? "true" : undefined} className={`eyebrow py-1 ${s === sort ? "!text-bone underline underline-offset-4" : "hover:text-bone"}`} href={href(category, s)} key={s}>{sorts[s]}</Link>
          ))}
        </nav>
      </div>
      <p aria-live="polite" className="eyebrow mt-4">{list.length} {list.length === 1 ? "product" : "products"}</p>
      {list.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      ) : (
        <p className="mt-16 text-steel">Nothing in this category yet.</p>
      )}
    </div>
  );
}
