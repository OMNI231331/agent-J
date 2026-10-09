import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/store/product-purchase";
import { getProduct } from "@/lib/catalog";
import { productAvailability } from "@/lib/inventory";
import { getStockMap } from "@/lib/commerce/stock";

type Props = { params: Promise<{ slug: string }> };

// Rendered per request so availability always reflects live inventory.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  if (!p) return {};
  const description = p.description.length > 155 ? `${p.description.slice(0, 152).trimEnd()}…` : p.description;
  return { title: p.name, description, openGraph: { title: `${p.name} — LSW`, description: p.tagline } };
}

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const stock = await getStockMap();
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
        availability: productAvailability(product, stock) === "in_stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    }),
  };
  return (
    <div className="container-lsw pt-8 pb-24 sm:pt-12">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />
      <ProductPurchase product={product} stock={stock} />
    </div>
  );
}
