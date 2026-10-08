"use client";

import { useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { useModal } from "@/lib/use-modal";
import { COLORS, money, type ColorId, type Product } from "@/lib/catalog";
import { availabilityLabel, getVariant, MAX_PER_LINE, variantAvailability, type StockMap } from "@/lib/inventory";
import { ProductArt } from "./product-art";
import type { ArtView } from "./garment-art";

const VIEWS: { view: ArtView; label: string }[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
  { view: "detail", label: "Detail" },
  { view: "label", label: "Label" },
];

export function ProductPurchase({ product, stock }: { product: Product; stock: StockMap }) {
  const { add } = useCart();
  const firstColor = product.colors.find((c) => product.variants.some((v) => v.color === c && variantAvailability(product, v, stock) === "in_stock")) ?? product.colors[0];
  const [color, setColor] = useState<ColorId>(firstColor);
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [view, setView] = useState<ArtView>("front");
  const [showError, setShowError] = useState(false);
  const [guide, setGuide] = useState(false);

  const variant = size ? getVariant(product, color, size) : undefined;
  const status = size ? variantAvailability(product, variant, stock) : null;
  const canBuy = status === "in_stock";
  const sizeStates = useMemo(
    () => Object.fromEntries(product.sizes.map((s) => [s, variantAvailability(product, getVariant(product, color, s), stock)])),
    [product, color, stock],
  );

  function changeColor(c: ColorId) {
    setColor(c);
    // keep the size only if it exists and is purchasable in the new colour
    if (size && variantAvailability(product, getVariant(product, c, size), stock) !== "in_stock") setSize(null);
  }

  function addToBag() {
    if (!size) return setShowError(true);
    if (!variant || !canBuy) return;
    add(variant.sku);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
      {/* gallery */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="img-frame aspect-[4/5]">
          <ProductArt className="h-full w-full" color={color} product={product} view={view} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3" role="group" aria-label="Product views">
          {VIEWS.map((v) => (
            <button aria-label={`Show ${v.label.toLowerCase()} view`} aria-pressed={view === v.view} className={`img-frame aspect-[4/5] ${view === v.view ? "!border-silver" : "opacity-70 hover:opacity-100"}`} key={v.view} onClick={() => setView(v.view)} type="button">
              <ProductArt className="h-full w-full" color={color} product={product} view={v.view} />
            </button>
          ))}
        </div>
        {!product.photos?.length && <p className="eyebrow mt-3">Concept renders — not photographs of manufactured product.</p>}
      </div>

      {/* buy box */}
      <div>
        <p className="eyebrow">DROP 001 · Decoration level {product.level}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{product.name}</h1>
        <p className="mt-4 font-mono text-xl">
          {money(product.priceCents)}
          {product.pricing === "draft" && <span className="eyebrow ml-3 align-middle">Draft price</span>}
        </p>
        <p className="mt-5 leading-relaxed text-silver">{product.description}</p>

        {!product.purchasable ? (
          <div className="mt-8 border border-line p-5">
            <p className="eyebrow !text-bone">{availabilityLabel.concept}</p>
            <p className="mt-2 text-sm text-steel">This piece is shown to preview the direction of the collection. It can&apos;t be ordered. Join the early-access list for updates.</p>
          </div>
        ) : (
          <>
            <fieldset className="mt-8">
              <legend className="eyebrow">Color — <span className="text-bone">{COLORS[color].name}</span></legend>
              <div className="mt-3 flex gap-3">
                {product.colors.map((c) => (
                  <label className="cursor-pointer" key={c}>
                    <input checked={color === c} className="peer sr-only" name="color" onChange={() => changeColor(c)} type="radio" value={c} />
                    <span className="block h-11 w-11 border border-line p-1 peer-checked:border-silver peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-silver">
                      <span className="block h-full w-full" style={{ background: COLORS[c].hex }} />
                    </span>
                    <span className="sr-only">{COLORS[c].name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-7">
              <div className="flex items-center justify-between">
                <legend className="eyebrow">Size</legend>
                <button className="eyebrow underline underline-offset-4 hover:text-bone" onClick={() => setGuide(true)} type="button">Size guide</button>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {product.sizes.map((s) => {
                  const ok = sizeStates[s] === "in_stock";
                  return (
                    <label className={ok ? "cursor-pointer" : "cursor-not-allowed"} key={s}>
                      <input checked={size === s} className="peer sr-only" disabled={!ok} name="size" onChange={() => { setSize(s); setShowError(false); }} type="radio" value={s} />
                      <span className={`relative grid min-h-12 place-items-center border text-sm transition-colors peer-checked:border-bone peer-checked:bg-bone peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-silver ${ok ? "border-line hover:border-silver" : "border-line/60 text-steel/60 line-through"}`}>
                        {s}
                      </span>
                      {!ok && <span className="sr-only"> (unavailable)</span>}
                    </label>
                  );
                })}
              </div>
              {showError && <p className="mt-3 text-sm text-alert" role="alert">Select a size to continue.</p>}
            </fieldset>

            <p aria-live="polite" className="eyebrow mt-6 min-h-4">
              {status ? availabilityLabel[status] : "Select a size to see availability"}
            </p>
            <button aria-disabled={size ? !canBuy : false} className="btn mt-3 w-full" disabled={!!size && !canBuy} onClick={addToBag} type="button">
              {!size ? "Select a size" : canBuy ? `Add to bag — ${money(product.priceCents)}` : "Unavailable"}
            </button>
            <p className="mt-3 text-xs text-steel">Limit {MAX_PER_LINE} per item. Limited-run releases may not restock.</p>
          </>
        )}

        <div className="mt-10 border-t border-line">
          <Accordion title="Fit" open>{product.fit}</Accordion>
          <Accordion title="Fabric">
            <p>{product.fabric.summary}</p>
            <p className="mt-2 text-steel">Fiber composition: {product.fabric.composition ?? "to be confirmed with the manufacturer — will be published and printed on the care label."}</p>
          </Accordion>
          <Accordion title="Details & decoration">
            <ul className="list-disc space-y-1.5 pl-5">{product.details.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="mt-3 text-steel">Dimensions listed are design targets, not final production specifications.</p>
          </Accordion>
          <Accordion title="Care">
            <ul className="list-disc space-y-1.5 pl-5">{product.care.map((d) => <li key={d}>{d}</li>)}</ul>
          </Accordion>
          <Accordion title="Shipping & returns">
            Shipping rates, delivery times, and the returns policy are being finalized before launch. See <a className="underline" href="/shipping-returns">Shipping &amp; returns</a> for current status.
          </Accordion>
        </div>
      </div>

      {guide && <SizeGuide product={product} onClose={() => setGuide(false)} />}
    </div>
  );
}

function Accordion({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-b border-line py-4" open={open}>
      <summary className="eyebrow flex cursor-pointer list-none items-center justify-between !text-bone [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-silver">{children}</div>
    </details>
  );
}

function SizeGuide({ product, onClose }: { product: Product; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(true, ref, onClose);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div aria-hidden className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div aria-labelledby="size-guide-title" aria-modal="true" className="relative w-full max-w-lg border border-line bg-coal p-6 outline-none" ref={ref} role="dialog" tabIndex={-1}>
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl" id="size-guide-title">Size guide</h2>
          <button className="eyebrow hover:text-bone" onClick={onClose} type="button">Close</button>
        </div>
        <p className="mt-3 border border-line p-3 text-sm text-steel"><strong className="text-bone">Draft.</strong> {product.sizeGuide.note}</p>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="eyebrow"><tr><th className="py-2 font-normal">Size</th><th className="font-normal">Chest</th><th className="font-normal">Length</th><th className="font-normal">Sleeve</th></tr></thead>
          <tbody>
            {product.sizeGuide.rows.map((r) => (
              <tr className="border-t border-line" key={r.size}>
                <td className="py-2.5">{r.size}</td>
                <td className="text-steel">{r.chest ?? "TBC"}</td>
                <td className="text-steel">{r.length ?? "TBC"}</td>
                <td className="text-steel">{r.sleeve ?? "TBC"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
