"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { formatPrice, getProduct } from "@/lib/lsw";
import { lineKey, useCart } from "./cart-provider";
import { ProductArt } from "./product-art";

export function CartDrawer() {
  const { lines, subtotal, open, setOpen, setQty, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Checkout failed. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div aria-label="Shopping bag" aria-modal="true" className="fixed inset-0 z-50 flex animate-[lsw-fade_220ms_ease-out] justify-end bg-black/70 backdrop-blur-[2px]" onClick={() => setOpen(false)} role="dialog">
      <aside className="flex h-full w-full max-w-md animate-[lsw-slide-in_360ms_cubic-bezier(0.22,1,0.36,1)] flex-col border-l border-white/10 bg-[#0a0a0b] p-6 text-neutral-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.25em]">Bag</h2>
          <button aria-label="Close bag" onClick={() => setOpen(false)} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 flex-1 space-y-5 overflow-auto">
          {lines.length === 0 && (
            <div className="text-sm text-neutral-400">
              <p>Your bag is empty.</p>
              <Link className="mt-4 inline-block border-b border-neutral-400 pb-0.5 text-neutral-200" href="/shop" onClick={() => setOpen(false)}>
                Browse the collection
              </Link>
            </div>
          )}
          {lines.map((l) => {
            const p = getProduct(l.slug);
            const c = p?.colors.find((x) => x.id === l.colorId);
            if (!p || !c) return null;
            const key = lineKey(l);
            return (
              <div className="flex gap-4" key={key}>
                <ProductArt className="h-24 w-20 shrink-0 object-cover" color={c.hex} kind={p.kind} view="front" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-neutral-400">
                    {c.name} / {l.size}
                  </p>
                  <p className="mt-1">{formatPrice(p.price)}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button aria-label="Decrease quantity" className="h-6 w-6 border border-white/20" onClick={() => setQty(key, l.qty - 1)} type="button">
                      -
                    </button>
                    <span aria-live="polite">{l.qty}</span>
                    <button aria-label="Increase quantity" className="h-6 w-6 border border-white/20" onClick={() => setQty(key, l.qty + 1)} type="button">
                      +
                    </button>
                    <button className="ml-auto text-xs text-neutral-400 underline" onClick={() => remove(key)} type="button">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">Shipping and tax are calculated at checkout.</p>
          {error && (
            <p className="mt-3 border border-white/15 p-3 text-xs text-neutral-300" role="alert">
              {error}
            </p>
          )}
          <button className="mt-4 w-full bg-neutral-100 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black disabled:opacity-40" disabled={lines.length === 0 || busy} onClick={checkout} type="button">
            {busy ? "One moment" : "Checkout"}
          </button>
        </div>
      </aside>
    </div>
  );
}
