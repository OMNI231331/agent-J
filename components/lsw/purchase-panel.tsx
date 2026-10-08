"use client";

import { useEffect, useState } from "react";
import { formatPrice, isVariantAvailable, variantKey, type Product } from "@/lib/lsw";
import { useCart } from "./cart-provider";
import { ProductArt, type ArtView } from "./product-art";

const views: { id: ArtView; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "detail", label: "Detail" },
];

export function PurchasePanel({ product }: { product: Product }) {
  const { add } = useCart();
  const [colorId, setColorId] = useState(product.colors[0].id);
  const [size, setSize] = useState<string | null>(null);
  const [view, setView] = useState<ArtView>("front");
  const [needSize, setNeedSize] = useState(false);
  const color = product.colors.find((c) => c.id === colorId) ?? product.colors[0];

  // Live stock: only "can be bought or not" per variant. If Redis isn't configured the page stays in preview mode.
  const [live, setLive] = useState<{ configured: boolean; variants: Record<string, boolean> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability/${product.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setLive(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product.slug]);
  const buyable = (cid: string, s: string) => isVariantAvailable(product, cid, s) && (!live?.configured || live.variants[variantKey(cid, s)] === true);
  const soldOutEverywhere = !!live?.configured && product.colors.every((c) => product.sizes.every((s) => !buyable(c.id, s)));

  function addToBag() {
    if (!size) {
      setNeedSize(true);
      return;
    }
    add({ slug: product.slug, colorId, size });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="overflow-hidden border border-white/10">
          <div className="animate-[lsw-fade_350ms_ease-out]" key={`${colorId}-${view}`}>
            <ProductArt className="aspect-[5/6] w-full" color={color.hex} kind={product.kind} view={view} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3" role="tablist" aria-label="Product views">
          {views.map((v) => (
            <button
              aria-selected={view === v.id}
              className={`border text-xs uppercase tracking-widest ${view === v.id ? "border-white/70" : "border-white/10 opacity-70 hover:opacity-100"}`}
              key={v.id}
              onClick={() => setView(v.id)}
              role="tab"
              type="button"
            >
              <ProductArt className="aspect-[5/6] w-full" color={color.hex} kind={product.kind} view={v.id} />
              <span className="block py-2">{v.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-400">Images are concept mockups. Photographs of real samples will replace them.</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">{product.tier} / Drop 001</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-3 text-lg">
          {formatPrice(product.price)} <span className="ml-2 text-[10px] uppercase tracking-widest text-neutral-400">Draft price</span>
        </p>
        <p className="mt-5 text-sm leading-relaxed text-neutral-300">{product.description}</p>

        <fieldset className="mt-8">
          <legend className="text-xs uppercase tracking-[0.2em] text-neutral-400">Color: {color.name}</legend>
          <div className="mt-3 flex gap-3">
            {product.colors.map((c) => (
              <button
                aria-label={c.name}
                aria-pressed={c.id === colorId}
                className={`h-9 w-9 rounded-full border-2 ${c.id === colorId ? "border-white" : "border-white/20"}`}
                key={c.id}
                onClick={() => {
                  setColorId(c.id);
                  if (size && !buyable(c.id, size)) setSize(null);
                }}
                style={{ background: c.hex }}
                type="button"
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-xs uppercase tracking-[0.2em] text-neutral-400">Size</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.sizes.map((s) => {
              const ok = buyable(colorId, s);
              return (
                <button
                  aria-pressed={size === s}
                  className={`h-11 min-w-12 border px-3 text-sm ${size === s ? "border-white bg-white text-black" : "border-white/20"} ${ok ? "" : "cursor-not-allowed text-neutral-400 line-through"}`}
                  disabled={!ok}
                  key={s}
                  onClick={() => {
                    setSize(s);
                    setNeedSize(false);
                  }}
                  type="button"
                >
                  {s}
                </button>
              );
            })}
          </div>
          {needSize && (
            <p className="mt-3 text-xs text-neutral-300" role="alert">
              Select a size first.
            </p>
          )}
        </fieldset>

        <button className="mt-8 w-full bg-neutral-100 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={soldOutEverywhere} onClick={addToBag} type="button">
          {soldOutEverywhere ? "Sold out" : "Add to bag"}
        </button>
        {live && !live.configured && <p className="mt-3 text-xs text-neutral-400">Preview: this product is not on sale yet, and checkout stays closed until it is.</p>}

        <div className="mt-10 divide-y divide-white/10 border-y border-white/10 text-sm">
          <Detail title="Fit">{product.fit}</Detail>
          <Detail title="Design and decoration">
            <ul className="list-disc space-y-1 pl-5">{product.decoration.map((d) => <li key={d}>{d}</li>)}</ul>
          </Detail>
          <Detail title="Fabric (draft)">{product.fabricDraft}</Detail>
          <Detail title="Details">
            <ul className="list-disc space-y-1 pl-5">{product.details.map((d) => <li key={d}>{d}</li>)}</ul>
          </Detail>
          <Detail title="Care (draft)">{product.careDraft}</Detail>
          <Detail title="Shipping and returns">Policies are being finalized. See the shipping and returns page.</Detail>
        </div>
      </div>
    </div>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-neutral-300">{title}</summary>
      <div className="mt-3 text-neutral-400">{children}</div>
    </details>
  );
}
