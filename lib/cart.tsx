"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { findSku, MAX_PER_LINE, variantAvailability } from "./inventory";

/** The cart only stores SKU + quantity. Name, price, color and size are always derived from the catalog. */
export type CartLine = { sku: string; qty: number };
type Action =
  | { type: "add"; sku: string; qty?: number }
  | { type: "setQty"; sku: string; qty: number }
  | { type: "remove"; sku: string }
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "clear" };

const KEY = "lsw.cart.v1";

function maxFor(sku: string) {
  const hit = findSku(sku);
  if (!hit || variantAvailability(hit.product, hit.variant) !== "in_stock") return 0;
  return Math.min(MAX_PER_LINE, hit.variant.stock ?? 0);
}

function reducer(lines: CartLine[], a: Action): CartLine[] {
  switch (a.type) {
    case "hydrate":
      return a.lines.filter((l) => maxFor(l.sku) > 0).map((l) => ({ ...l, qty: Math.min(l.qty, maxFor(l.sku)) }));
    case "add": {
      const max = maxFor(a.sku);
      if (!max) return lines;
      const existing = lines.find((l) => l.sku === a.sku);
      const qty = Math.min(max, (existing?.qty ?? 0) + (a.qty ?? 1));
      return existing ? lines.map((l) => (l.sku === a.sku ? { ...l, qty } : l)) : [...lines, { sku: a.sku, qty }];
    }
    case "setQty": {
      const max = maxFor(a.sku);
      if (a.qty <= 0 || !max) return lines.filter((l) => l.sku !== a.sku);
      return lines.map((l) => (l.sku === a.sku ? { ...l, qty: Math.min(a.qty, max) } : l));
    }
    case "remove":
      return lines.filter((l) => l.sku !== a.sku);
    case "clear":
      return [];
  }
}

type Ctx = {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (sku: string, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
};
const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, []);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          dispatch({
            type: "hydrate",
            lines: parsed.filter((l) => l && typeof l.sku === "string" && Number.isInteger(l.qty) && l.qty > 0),
          });
        }
      }
    } catch {
      /* storage unavailable or corrupt — start with an empty cart */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, hydrated]);

  const value = useMemo<Ctx>(() => {
    let count = 0;
    let subtotalCents = 0;
    for (const l of lines) {
      const hit = findSku(l.sku);
      if (!hit) continue;
      count += l.qty;
      subtotalCents += l.qty * hit.product.priceCents;
    }
    return {
      lines, count, subtotalCents, open, setOpen,
      add: (sku, qty) => { dispatch({ type: "add", sku, qty }); setOpen(true); },
      setQty: (sku, qty) => dispatch({ type: "setQty", sku, qty }),
      remove: (sku) => dispatch({ type: "remove", sku }),
      clear: () => dispatch({ type: "clear" }),
    };
  }, [lines, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
