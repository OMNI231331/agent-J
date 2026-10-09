import { findSku, MAX_CART_LINES, MAX_PER_LINE, MAX_UNITS_PER_ORDER } from "./catalog.ts";

/** The cart only stores SKU + quantity. Name, price, color and size are always derived from the catalog. */
export type CartLine = { sku: string; qty: number };
export type CartAction =
  | { type: "add"; sku: string; qty?: number }
  | { type: "setQty"; sku: string; qty: number }
  | { type: "remove"; sku: string }
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "clear" };

/** Live stock is only known to the server; it is re-checked atomically at checkout. */
export function maxFor(sku: string): number {
  const hit = findSku(sku);
  return hit && hit.product.purchasable ? MAX_PER_LINE : 0;
}

export const unitsIn = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);

/**
 * Turns anything found in storage into a bag that obeys every limit: unknown / concept SKUs dropped,
 * duplicate SKUs merged, each line capped, at most MAX_CART_LINES lines and MAX_UNITS_PER_ORDER units.
 * Input size is bounded first so a huge or hostile saved bag can't freeze the page.
 */
export function sanitizeLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const l of input.slice(0, MAX_CART_LINES * 10)) {
    if (!l || typeof l !== "object") continue;
    const { sku, qty } = l as Partial<CartLine>;
    if (typeof sku !== "string" || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || maxFor(sku) === 0) continue;
    merged.set(sku, Math.min(MAX_PER_LINE, (merged.get(sku) ?? 0) + qty));
  }
  const out: CartLine[] = [];
  let units = 0;
  for (const [sku, qty] of merged) {
    const room = MAX_UNITS_PER_ORDER - units;
    if (out.length >= MAX_CART_LINES || room <= 0) break;
    const q = Math.min(qty, room);
    out.push({ sku, qty: q });
    units += q;
  }
  return out;
}

export function cartReducer(lines: CartLine[], a: CartAction): CartLine[] {
  switch (a.type) {
    case "hydrate":
      return sanitizeLines(a.lines);
    case "add": {
      const max = maxFor(a.sku);
      const existing = lines.find((l) => l.sku === a.sku);
      const room = MAX_UNITS_PER_ORDER - unitsIn(lines);
      const want = Number.isInteger(a.qty) && (a.qty as number) > 0 ? (a.qty as number) : 1;
      const add = Math.min(want, room, max - (existing?.qty ?? 0));
      if (!max || add <= 0) return lines;
      return existing ? lines.map((l) => (l.sku === a.sku ? { ...l, qty: l.qty + add } : l)) : lines.length >= MAX_CART_LINES ? lines : [...lines, { sku: a.sku, qty: add }];
    }
    case "setQty": {
      const max = maxFor(a.sku);
      if (!Number.isFinite(a.qty) || a.qty <= 0 || !max) return lines.filter((l) => l.sku !== a.sku);
      const current = lines.find((l) => l.sku === a.sku)?.qty ?? 0;
      const room = MAX_UNITS_PER_ORDER - (unitsIn(lines) - current);
      const qty = Math.min(Math.floor(a.qty), max, room);
      return qty <= 0 ? lines : lines.map((l) => (l.sku === a.sku ? { ...l, qty } : l));
    }
    case "remove":
      return lines.filter((l) => l.sku !== a.sku);
    case "clear":
      return [];
  }
}
