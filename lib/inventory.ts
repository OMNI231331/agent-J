import { products, type Product, type Variant } from "./catalog";

export type Availability = "in_stock" | "out_of_stock" | "unconfirmed" | "concept";

const bySku = new Map<string, { product: Product; variant: Variant }>(
  products.flatMap((product) => product.variants.map((variant) => [variant.sku, { product, variant }] as const)),
);

export const findSku = (sku: string) => bySku.get(sku);

/** Single place that decides whether a variant can be sold. Swap the stock source here. */
export function variantAvailability(product: Product, variant: Variant | undefined): Availability {
  if (!product.purchasable) return "concept";
  if (!variant || variant.stock === null) return "unconfirmed";
  return variant.stock > 0 ? "in_stock" : "out_of_stock";
}

export const getVariant = (product: Product, color: string, size: string) =>
  product.variants.find((v) => v.color === color && v.size === size);

export function productAvailability(product: Product): Availability {
  if (!product.purchasable) return "concept";
  const states = product.variants.map((v) => variantAvailability(product, v));
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

/** Max units per line a customer may buy (limited-drop guard; stock is checked separately). */
export const MAX_PER_LINE = 3;
