import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchasePanel } from "@/components/lsw/purchase-panel";
import { getProduct, products } from "@/lib/lsw";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  return p ? { title: p.name, description: p.description } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link className="text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-200" href="/shop">
        Back to shop
      </Link>
      <div className="mt-6">
        <PurchasePanel product={product} />
      </div>
    </div>
  );
}
