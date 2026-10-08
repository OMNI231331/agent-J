import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/store/product-purchase";
import { getProduct, products } from "@/lib/catalog";
import { productAvailability } from "@/lib/inventory";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => products.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  if (!p) return {};
  return { title: p.name, description: p.description, openGraph: { title: `${p.name} — LSW`, description: p.tagline } };
}

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: "LSW" },
    // Offers are only emitted for sellable, confirmed-price products.
    ...(product.purchasable && product.pricing === "confirmed" && {
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: (product.priceCents / 100).toFixed(2),
        availability: productAvailability(product) === "in_stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    }),
  };
  return (
    <div className="container-lsw py-8 sm:py-12">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
      <ProductPurchase product={product} />
    </div>
  );
}
