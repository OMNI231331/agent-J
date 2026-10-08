"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProduct, isVariantAvailable } from "@/lib/lsw";

export type CartLine = { slug: string; colorId: string; size: string; qty: number };

type CartContext = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (line: Omit<CartLine, "qty">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartContext | null>(null);
const STORAGE_KEY = "lsw-cart-v1";
export const lineKey = (l: Pick<CartLine, "slug" | "colorId" | "size">) => `${l.slug}|${l.colorId}|${l.size}`;

// Drop anything that no longer matches real product data, so a stale cart can never show a wrong price or variant.
function sanitize(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const { slug, colorId, size, qty } = l as CartLine;
    const p = typeof slug === "string" ? getProduct(slug) : undefined;
    if (!p || !p.colors.some((c) => c.id === colorId) || !p.sizes.includes(size) || !isVariantAvailable(p, colorId, size)) continue;
    if (!Number.isInteger(qty) || qty < 1) continue;
    out.push({ slug, colorId, size, qty: Math.min(qty, 10) });
  }
  return out;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setLines(sanitize(JSON.parse(saved)));
    } catch {
      /* storage unavailable or corrupt: start with an empty cart */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, "qty">) => {
    setLines((cur) => {
      const key = lineKey(line);
      const hit = cur.find((l) => lineKey(l) === key);
      if (hit) return cur.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(l.qty + 1, 10) } : l));
      return [...cur, { ...line, qty: 1 }];
    });
    setOpen(true);
  }, []);

  const setQty = useCallback(
    (key: string, qty: number) =>
      setLines((cur) => (qty < 1 ? cur.filter((l) => lineKey(l) !== key) : cur.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(qty, 10) } : l)))),
    [],
  );
  const remove = useCallback((key: string) => setLines((cur) => cur.filter((l) => lineKey(l) !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContext>(() => {
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => s + l.qty * (getProduct(l.slug)?.price ?? 0), 0);
    return { lines, count, subtotal, open, setOpen, add, setQty, remove, clear };
  }, [lines, open, add, setQty, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
