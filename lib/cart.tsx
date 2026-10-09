"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { findSku } from "./catalog";
import { cartReducer, type CartLine } from "./cart-logic";

export type { CartLine } from "./cart-logic";

const KEY = "lsw.cart.v1";

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
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Anything in storage is untrusted: the reducer merges duplicates and enforces every limit.
        if (Array.isArray(parsed)) dispatch({ type: "hydrate", lines: parsed as CartLine[] });
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
