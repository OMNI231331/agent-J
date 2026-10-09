"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useModal } from "@/lib/use-modal";
import { COLORS, money } from "@/lib/catalog";
import { findSku, MAX_PER_LINE } from "@/lib/catalog";
import { ProductArt } from "./product-art";

export function CartDrawer() {
  const { open, setOpen, lines, subtotalCents, count, setQty, remove } = useCart();
  const panelRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModal(open, panelRef, () => setOpen(false));

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({ sku: l.sku, qty: l.qty, priceCents: findSku(l.sku)?.product.priceCents })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed. Please try again.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed. Please try again.");
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
      <aside aria-label="Shopping bag" aria-modal="true" className="relative flex h-dvh w-full max-w-md flex-col border-l border-line bg-coal outline-none" ref={panelRef} role="dialog" tabIndex={-1}>
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <h2 className="eyebrow !text-bone">Bag ({count})</h2>
          <button aria-label="Close bag" className="-mr-2 grid h-11 w-11 place-items-center" onClick={() => setOpen(false)} type="button">
            <X size={20} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <p className="display text-3xl">Your bag is empty</p>
            <p className="text-sm text-steel">Nothing here yet. DROP 001 is waiting.</p>
            <Link className="btn" href="/shop" onClick={() => setOpen(false)}>Shop Drop 001</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-auto px-5">
              {lines.map((l) => {
                const hit = findSku(l.sku);
                if (!hit) return null;
                const { product, variant } = hit;
                const max = MAX_PER_LINE;
                return (
                  <li className="flex gap-4 py-5" key={l.sku}>
                    <Link className="img-frame block w-24 shrink-0" href={`/products/${product.slug}`} onClick={() => setOpen(false)}>
                      <ProductArt className="aspect-[4/5] w-full" product={product} color={variant.color} view="front" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="font-mono text-sm">{money(product.priceCents * l.qty)}</p>
                      </div>
                      <p className="mt-1 text-xs text-steel">
                        {COLORS[variant.color].name} · {variant.size}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex items-center border border-line">
                          <button aria-label={`Decrease quantity of ${product.name}`} className="grid h-9 w-9 place-items-center" onClick={() => setQty(l.sku, l.qty - 1)} type="button"><Minus size={14} /></button>
                          <span aria-live="polite" className="w-8 text-center font-mono text-sm">{l.qty}</span>
                          <button aria-label={`Increase quantity of ${product.name}`} className="grid h-9 w-9 place-items-center disabled:opacity-30" disabled={l.qty >= max} onClick={() => setQty(l.sku, l.qty + 1)} type="button"><Plus size={14} /></button>
                        </div>
                        <button className="eyebrow underline underline-offset-4 hover:text-bone" onClick={() => remove(l.sku)} type="button">Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line p-5">
              <div className="flex justify-between">
                <span className="eyebrow !text-bone">Subtotal</span>
                <span className="font-mono">{money(subtotalCents)}</span>
              </div>
              <p className="mt-2 text-xs text-steel">Shipping and taxes are calculated at checkout. Limit {MAX_PER_LINE} per item.</p>
              {error && <p className="mt-3 text-sm text-alert" role="alert">{error}</p>}
              <button className="btn mt-4 w-full" disabled={busy} onClick={checkout} type="button">
                {busy ? "Starting checkout…" : "Checkout"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
