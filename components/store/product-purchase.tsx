"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { useModal } from "@/lib/use-modal";
import { COLORS, money, type ColorId, type Product } from "@/lib/catalog";
import { availabilityLabel, getVariant, MAX_PER_LINE, variantAvailability, type StockMap } from "@/lib/inventory";
import type { DropView } from "@/lib/drop-server";
import { site } from "@/lib/site";
import { ProductArt } from "./product-art";
import type { ArtView } from "./garment-art";

const VIEWS: { view: ArtView; label: string }[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
  { view: "detail", label: "Detail" },
  { view: "label", label: "Label" },
];

export function ProductPurchase({ product, stock, drop }: { product: Product; stock: StockMap; drop: DropView }) {
  const { add } = useCart();
  const firstColor = product.colors.find((c) => product.variants.some((v) => v.color === c && variantAvailability(product, v, stock) === "in_stock")) ?? product.colors[0];
  const [color, setColor] = useState<ColorId>(firstColor);
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [view, setView] = useState<ArtView>("front");
  const [showError, setShowError] = useState(false);
  const [guide, setGuide] = useState(false);

  const variant = size ? getVariant(product, color, size) : undefined;
  const status = size ? variantAvailability(product, variant, stock) : null;
  const releaseClosed = !drop.canBuy; // the checkout API enforces this too; this only keeps the UI honest
  const canBuy = status === "in_stock" && !releaseClosed;
  const buyRef = useRef<HTMLButtonElement>(null);
  const [buyVisible, setBuyVisible] = useState(true);
  useEffect(() => {
    const el = buyRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setBuyVisible(e.isIntersecting || e.boundingClientRect.top > window.innerHeight));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const showSticky = product.purchasable && !buyVisible;
  useEffect(() => {
    // WCAG 2.4.11: keep focused controls from sliding under the sticky bar on mobile.
    document.documentElement.style.scrollPaddingBottom = showSticky ? "6rem" : "";
    return () => { document.documentElement.style.scrollPaddingBottom = ""; };
  }, [showSticky]);
  const buyLabel = !size ? "Select a size" : releaseClosed && status === "in_stock" ? `Opens ${drop.opensLabel ?? "soon"}` : canBuy ? `Add to bag — ${money(product.priceCents)}` : "Unavailable";
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
    if (!size) {
      setShowError(true);
      document.getElementById("size-fieldset")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!variant || !canBuy) return;
    add(variant.sku);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
      {/* gallery */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="img-frame aspect-[4/5]">
          <ProductArt className="lsw-swap h-full w-full" color={color} key={`${color}-${view}`} product={product} view={view} />
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

            <fieldset className="mt-7" id="size-fieldset">
              <div className="flex items-center justify-between">
                <legend className="eyebrow">Size</legend>
                <button className="eyebrow -my-3 py-3 underline underline-offset-4 hover:text-bone" onClick={() => setGuide(true)} type="button">Size guide</button>
              </div>
              <p className="mt-2 text-xs text-steel">{product.fit}</p>
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
              {status ? (releaseClosed && status === "in_stock" ? `Available at release · ${drop.opensLabel}` : availabilityLabel[status]) : "Select a size to see availability"}
            </p>
            <button aria-disabled={size ? !canBuy : false} className="btn mt-3 w-full" disabled={!!size && !canBuy} onClick={addToBag} ref={buyRef} type="button">
              {buyLabel}
            </button>
            <ul className="mt-4 space-y-1.5 text-xs text-steel">
              <li>{site.shippingSummary ?? "US shipping. The exact shipping cost is shown at checkout, before you pay."}</li>
              {site.returnsSummary && <li>{site.returnsSummary}</li>}
              <li>Limit {MAX_PER_LINE} per item. Limited-run releases may not restock.</li>
            </ul>
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
            {site.shippingSummary || site.returnsSummary ? (
              <>{[site.shippingSummary, site.returnsSummary].filter(Boolean).join(" · ")}. Full terms: <a className="underline" href="/shipping-returns">Shipping &amp; returns</a>.</>
            ) : (
              <>Shipping rates, delivery times, and the returns policy are being finalized before launch. See <a className="underline" href="/shipping-returns">Shipping &amp; returns</a> for current status.</>
            )}
          </Accordion>
        </div>
      </div>

      {guide && <SizeGuide product={product} onClose={() => setGuide(false)} />}

      {/* Mobile sticky add-to-bag: appears only once the main button has scrolled away. Inset, not full-width (Baymard). */}
      {showSticky && (
        <div className="fixed inset-x-3 bottom-3 z-40 flex animate-[lsw-fade_200ms_ease-out] items-center gap-3 border border-line bg-coal/95 p-2.5 pl-4 shadow-2xl backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">{product.name}</p>
            <p className="font-mono text-xs text-steel">{money(product.priceCents)}{size ? ` · ${COLORS[color].name} · ${size}` : ""}</p>
          </div>
          <button className="btn !min-h-11 shrink-0 !px-5" disabled={!!size && !canBuy} onClick={addToBag} type="button">
            {!size ? "Choose size" : canBuy ? "Add to bag" : releaseClosed && status === "in_stock" ? "Not open yet" : "Unavailable"}
          </button>
        </div>
      )}
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

const IN_PER_CM = 1 / 2.54;

function SizeGuide({ product, onClose }: { product: Product; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState<"in" | "cm">("in");
  useModal(true, ref, onClose);
  const fmt = (cm?: number) => (cm == null ? "TBC" : unit === "cm" ? `${cm}` : `${(cm * IN_PER_CM).toFixed(1)}`);
  const verified = product.sizeGuide.rows.some((r) => r.chestCm != null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div aria-hidden className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div aria-labelledby="size-guide-title" aria-modal="true" className="relative max-h-[90dvh] w-full max-w-lg overflow-auto border border-line bg-coal p-6 outline-none" ref={ref} role="dialog" tabIndex={-1}>
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl" id="size-guide-title">Size guide</h2>
          <button className="eyebrow -m-3 p-3 hover:text-bone" onClick={onClose} type="button">Close</button>
        </div>
        <p className="mt-3 text-sm text-silver">{product.fit}</p>
        {!verified && <p className="mt-3 border border-line p-3 text-sm text-steel"><strong className="text-bone">Draft.</strong> {product.sizeGuide.note}</p>}
        <div className="mt-5 flex items-center justify-between">
          <p className="eyebrow">Garment measurements, laid flat</p>
          <div className="flex border border-line" role="group" aria-label="Units">
            {(["in", "cm"] as const).map((u) => (
              <button aria-pressed={unit === u} className={`eyebrow min-h-9 px-3 ${unit === u ? "bg-bone !text-ink" : "hover:text-bone"}`} key={u} onClick={() => setUnit(u)} type="button">{u}</button>
            ))}
          </div>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Measurements in {unit === "in" ? "inches" : "centimetres"}</caption>
          <thead className="eyebrow"><tr><th className="py-2 font-normal" scope="col">Size</th><th className="font-normal" scope="col">½ Chest</th><th className="font-normal" scope="col">Length</th><th className="font-normal" scope="col">Sleeve</th></tr></thead>
          <tbody>
            {product.sizeGuide.rows.map((r) => (
              <tr className="border-t border-line" key={r.size}>
                <th className="py-2.5 font-normal" scope="row">{r.size}</th>
                <td className="font-mono text-steel">{fmt(r.chestCm)}</td>
                <td className="font-mono text-steel">{fmt(r.lengthCm)}</td>
                <td className="font-mono text-steel">{fmt(r.sleeveCm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-steel">
          <p className="eyebrow !text-bone">How to compare</p>
          <p className="mt-2">Lay a hoodie or tee you already like flat. Measure armpit to armpit (½ chest), then high-point shoulder to hem (length). Pick the LSW size closest to those numbers. Oversized is the designed fit — size down only if you want it closer to the body.</p>
        </div>
      </div>
    </div>
  );
}
