import { allSkus, findSku } from "../catalog.ts";
import { site } from "../site.ts";
import type { StockMap } from "../inventory.ts";
import { getStore } from "./redis.ts";

/**
 * Stock for display. Source of truth is Redis. Without Redis, preview builds show the catalog's
 * demo seed so the storefront can be reviewed; live builds show "to be confirmed" instead.
 * Counts are never rendered to customers, only in-stock / out-of-stock.
 */
export async function getStockMap(): Promise<StockMap> {
  const skus = allSkus();
  const store = getStore();
  if (store) {
    try {
      return await store.getStock(skus);
    } catch (e) {
      console.error("stock: Redis unavailable", e instanceof Error ? e.message : e);
      return Object.fromEntries(skus.map((s) => [s, null]));
    }
  }
  if (site.mode === "preview") return Object.fromEntries(skus.map((s) => [s, findSku(s)!.variant.stock]));
  return Object.fromEntries(skus.map((s) => [s, null]));
}
