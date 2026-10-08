import { findSku, MAX_PER_LINE, type Product, type Variant } from "./catalog";
import { site } from "./site";

export { findSku, MAX_PER_LINE };
export type Availability = "in_stock" | "out_of_stock" | "unconfirmed" | "concept";
/** Units available per SKU. `null` = not stocked / unknown. Produced server-side by lib/commerce/stock.ts. */
export type StockMap = Record<string, number | null>;

/** Single place that decides how a variant is displayed. The server re-checks everything at checkout. */
export function variantAvailability(product: Product, variant: Variant | undefined, stock: StockMap): Availability {
  if (!product.purchasable) return "concept";
  // Safety: a live store never sells a product whose price is still a draft.
  if (site.mode === "live" && product.pricing !== "confirmed") return "unconfirmed";
  const n = variant ? stock[variant.sku] : null;
  if (n === null || n === undefined) return "unconfirmed";
  return n > 0 ? "in_stock" : "out_of_stock";
}

export const getVariant = (product: Product, color: string, size: string) =>
  product.variants.find((v) => v.color === color && v.size === size);

export function productAvailability(product: Product, stock: StockMap): Availability {
  if (!product.purchasable) return "concept";
  const states = product.variants.map((v) => variantAvailability(product, v, stock));
  if (states.includes("in_stock")) return "in_stock";
  if (states.includes("unconfirmed")) return "unconfirmed";
  return "out_of_stock";
}

export const availabilityLabel: Record<Availability, string> = {
  in_stock: "Available",
  out_of_stock: "Out of stock",
  unconfirmed: "Availability to be confirmed",
  concept: "Concept — not in production",
};
