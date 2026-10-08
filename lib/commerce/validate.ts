import { findSku, MAX_PER_LINE } from "../catalog.ts";
import type { Line } from "./store.ts";

export type CartInput = { sku?: unknown; qty?: unknown; priceCents?: unknown; color?: unknown; size?: unknown };
export type ValidationResult = { ok: true; lines: Line[] } | { ok: false; status: 400 | 409; error: string };

export const MAX_LINES = 20;

/**
 * Server-side validation of a cart. The client only proposes SKU + quantity; price, product,
 * colour and size are derived from the catalog. If the client sends what it *displayed*
 * (price, colour, size), it must match, otherwise the customer is told rather than charged a surprise.
 */
export function validateCart(input: unknown, opts: { liveMode: boolean }): ValidationResult {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, status: 400, error: "Your bag is empty." };
  if (input.length > MAX_LINES) return { ok: false, status: 400, error: "Too many items in one order." };
  const totals = new Map<string, number>();
  for (const raw of input as CartInput[]) {
    if (!raw || typeof raw !== "object") return { ok: false, status: 400, error: "Invalid item in bag." };
    const sku = typeof raw.sku === "string" ? raw.sku : "";
    const qty = raw.qty;
    const hit = findSku(sku);
    if (!hit) return { ok: false, status: 400, error: "An item in your bag no longer exists." };
    const { product, variant } = hit;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) return { ok: false, status: 400, error: "Invalid quantity." };
    if (!product.purchasable) return { ok: false, status: 409, error: `${product.name} is not available to order.` };
    if (opts.liveMode && product.pricing !== "confirmed") return { ok: false, status: 409, error: `${product.name} is not on sale yet.` };
    if (raw.priceCents !== undefined && raw.priceCents !== product.priceCents)
      return { ok: false, status: 409, error: `The price of ${product.name} has changed. Please review your bag.` };
    if (raw.color !== undefined && raw.color !== variant.color) return { ok: false, status: 400, error: "Colour does not match the item." };
    if (raw.size !== undefined && raw.size !== variant.size) return { ok: false, status: 400, error: "Size does not match the item." };
    const total = (totals.get(sku) ?? 0) + qty;
    if (total > MAX_PER_LINE) return { ok: false, status: 409, error: `Limit ${MAX_PER_LINE} per item for ${product.name} (${variant.size}).` };
    totals.set(sku, total);
  }
  return { ok: true, lines: [...totals].map(([sku, qty]) => ({ sku, qty })) };
}
