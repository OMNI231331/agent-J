import Link from "next/link";
import { formatPrice, type Product } from "@/lib/lsw";
import { ProductArt } from "./product-art";

export function ProductCard({ product }: { product: Product }) {
  const first = product.colors[0];
  return (
    <Link className="group block" href={`/shop/${product.slug}`}>
      <div className="overflow-hidden border border-white/10 bg-[#0d0d0f]">
        <ProductArt className="aspect-[5/6] w-full transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none" color={first.hex} kind={product.kind} view="front" />
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-neutral-100">{product.name}</h3>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">{product.tier}</p>
          <div aria-label={`Colors: ${product.colors.map((c) => c.name).join(", ")}`} className="mt-3 flex gap-1.5" role="img">
            {product.colors.map((c) => (
              <span className="h-3.5 w-3.5 rounded-full border border-white/30" key={c.id} style={{ background: c.hex }} />
            ))}
          </div>
        </div>
        <div className="text-right text-sm text-neutral-200">
          <p>{formatPrice(product.price)}</p>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Draft price</p>
        </div>
      </div>
    </Link>
  );
}
