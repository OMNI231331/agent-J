import Link from "next/link";
import { COLORS, money, type Product } from "@/lib/catalog";
import { availabilityLabel, productAvailability } from "@/lib/inventory";
import { ProductArt } from "./product-art";

export function ProductCard({ product }: { product: Product }) {
  const status = productAvailability(product);
  return (
    <article className="group">
      <Link className="block" href={`/products/${product.slug}`}>
        <div className="img-frame relative aspect-[4/5] transition-colors group-hover:border-silver">
          <ProductArt className="absolute inset-0 h-full w-full transition-opacity duration-300 group-hover:opacity-0" color={product.colors[0]} product={product} view="front" />
          <ProductArt className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" color={product.colors[0]} product={product} view="back" />
          {status !== "in_stock" && (
            <span className="eyebrow absolute left-3 top-3 border border-line bg-ink/80 px-2 py-1 !text-bone">{availabilityLabel[status]}</span>
          )}
        </div>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide">{product.name}</h3>
            <p className="mt-1 text-xs text-steel">{product.tagline}</p>
          </div>
          <p className="font-mono text-sm">{money(product.priceCents)}</p>
        </div>
      </Link>
      <ul aria-label="Colors" className="mt-3 flex items-center gap-2">
        {product.colors.map((c) => (
          <li key={c} title={COLORS[c].name}>
            <span className="block h-3.5 w-3.5 border border-steel" style={{ background: COLORS[c].hex }} />
            <span className="sr-only">{COLORS[c].name}</span>
          </li>
        ))}
        <li className="eyebrow ml-1">{product.colors.length} {product.colors.length === 1 ? "color" : "colors"}</li>
      </ul>
    </article>
  );
}
