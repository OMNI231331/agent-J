"use client";

import { ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { brand, products, type Product } from "@/lib/store";

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Accessories"] as const;
const money = (n: number) => `$${n.toFixed(2)}`;

export function Storefront() {
  const [filter, setFilter] = useState<(typeof categories)[number]>("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const visible = filter === "All" ? products : products.filter((p) => p.category === filter);
  const lines = useMemo(
    () => products.filter((p) => cart[p.id]).map((p) => ({ product: p, qty: cart[p.id] })),
    [cart],
  );
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.product.price, 0);

  const add = (p: Product) => {
    setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
    setOpen(true);
  };
  const change = (id: string, d: number) =>
    setCart((c) => {
      const q = (c[id] ?? 0) + d;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a className="text-lg font-bold tracking-[0.25em]" href="#top">{brand.name}</a>
          <nav className="hidden gap-8 text-sm sm:flex">
            <a href="#shop">Shop</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <button aria-label="Open cart" className="relative p-2" onClick={() => setOpen(true)} type="button">
            <ShoppingBag size={22} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs text-white">{count}</span>
            )}
          </button>
        </div>
      </header>

      <section className="bg-neutral-100" id="top">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:py-36">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-neutral-500">New season</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{brand.tagline}</h1>
          <p className="mx-auto mt-6 max-w-xl text-neutral-600">
            Simple pieces, quality fabrics, fair prices. Designed to be worn on repeat.
          </p>
          <a className="mt-10 inline-block bg-black px-8 py-3 text-sm font-medium text-white" href="#shop">Shop the collection</a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20" id="shop">
        <h2 className="text-2xl font-bold">Shop</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              className={`border px-4 py-1.5 text-sm ${filter === c ? "border-black bg-black text-white" : "border-neutral-300"}`}
              key={c}
              onClick={() => setFilter(c)}
              type="button"
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {visible.map((p) => (
            <article key={p.id}>
              <div className="aspect-[4/5] w-full" style={{ background: p.swatch }} />
              <h3 className="mt-3 font-medium">{p.name}</h3>
              <p className="text-sm text-neutral-500">{p.description}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-medium">{money(p.price)}</span>
                <button className="border border-black px-3 py-1 text-sm hover:bg-black hover:text-white" onClick={() => add(p)} type="button">Add</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-neutral-900 text-white" id="about">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">About {brand.name}</h2>
          <p className="mt-4 text-neutral-300">
            We started with one idea: clothes you reach for every day should be well made. We use quality materials,
            work with small factories, and keep our collections tight so nothing goes to waste.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-16" id="contact">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-bold tracking-[0.25em]">{brand.name}</h2>
            <p className="mt-2 text-sm text-neutral-500">{brand.email}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubscribed(true);
            }}
          >
            {subscribed ? (
              <p className="text-sm">Thanks for subscribing!</p>
            ) : (
              <>
                <input className="min-w-0 flex-1 border border-neutral-300 px-3 py-2 text-sm" placeholder="Email for updates" required type="email" />
                <button className="bg-black px-4 py-2 text-sm text-white" type="submit">Join</button>
              </>
            )}
          </form>
        </div>
        <p className="mt-12 text-xs text-neutral-400">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
      </footer>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Your cart</h2>
              <button aria-label="Close cart" onClick={() => setOpen(false)} type="button"><X size={20} /></button>
            </div>
            <div className="mt-6 flex-1 space-y-4 overflow-auto">
              {lines.length === 0 && <p className="text-sm text-neutral-500">Your cart is empty.</p>}
              {lines.map(({ product, qty }) => (
                <div className="flex items-center gap-3" key={product.id}>
                  <div className="h-16 w-14 shrink-0" style={{ background: product.swatch }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-sm text-neutral-500">{money(product.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <button className="h-6 w-6 border" onClick={() => change(product.id, -1)} type="button">−</button>
                    <span>{qty}</span>
                    <button className="h-6 w-6 border" onClick={() => change(product.id, 1)} type="button">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between font-medium"><span>Subtotal</span><span>{money(total)}</span></div>
              <button className="mt-4 w-full bg-black py-3 text-sm text-white disabled:opacity-40" disabled={count === 0} onClick={() => alert("Checkout isn't connected yet — add a payment provider like Stripe to take real orders.")} type="button">
                Checkout
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
