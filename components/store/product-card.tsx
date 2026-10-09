import Link from "next/link";
import { COLORS, money, type Product } from "@/lib/catalog";
import { availabilityLabel, productAvailability, type StockMap } from "@/lib/inventory";
import { ProductArt } from "./product-art";

export function ProductCard({ product, stock }: { product: Product; stock: StockMap }) {
  const status = productAvailability(product, stock);
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
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide">{product.name}</h3>
            <p className="mt-1 text-xs text-steel">{product.tagline}</p>
          </div>
          <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
            <p className="font-mono text-sm">{money(product.priceCents)}</p>
            {product.pricing === "draft" && <p className="eyebrow !text-[9px]">Draft price</p>}
          </div>
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
