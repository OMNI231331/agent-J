// Inventory admin for Upstash Redis.  Usage (reads .env.local if present):
//   pnpm inventory show                  list every SKU and its live count
//   pnpm inventory add  <SKU> <+N|-N>    restock / correct relative to live stock (safe while customers are checking out)
//   pnpm inventory set  <SKU> <N>        absolute count (ONLY before launch or when no checkouts are open)
//   pnpm inventory orders [N]            most recent orders (paid / awaiting_payment / payment_failed / needs_attention)
//   pnpm inventory seed <N> --yes        set every purchasable SKU to N (first-time setup only; refuses if any SKU already has stock)
import { allSkus, findSku } from "../lib/catalog.ts";
import { getStore } from "../lib/commerce/redis.ts";

const store = getStore();
if (!store) {
  console.error("Redis isn't configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (see docs/CHECKOUT.md).");
  process.exit(1);
}
const [cmd, a, b] = process.argv.slice(2);
const skus = allSkus().filter((s) => findSku(s)!.product.purchasable);
const need = (sku?: string) => {
  if (!sku || !findSku(sku)) { console.error(`Unknown SKU: ${sku ?? "(none)"}. Run "pnpm inventory show" to list them.`); process.exit(1); }
  return sku;
};
const int = (v?: string) => { const n = Number(v); if (!Number.isInteger(n)) { console.error(`"${v}" is not a whole number.`); process.exit(1); } return n; };

if (cmd === "show") {
  const stock = await store.getStock(skus);
  for (const s of skus) console.log(s.padEnd(36), stock[s] === null ? "— (not stocked)" : stock[s]);
} else if (cmd === "orders") {
  const orders = await store.recentOrders(a ? int(a) : 20);
  if (!orders.length) console.log("No orders yet.");
  for (const o of orders) {
    const items = o.details.lines.map((l) => `${l.qty}× ${l.sku}`).join(", ");
    const total = o.details.amountTotal == null ? "?" : `$${(o.details.amountTotal / 100).toFixed(2)}`;
    console.log(`${new Date(o.createdAt).toISOString()}  ${o.status.padEnd(16)} ${total.padStart(9)}  ${o.details.email ?? "-"}  ${items}\n    ${o.sessionId}${o.details.note ? "\n    NOTE: " + o.details.note : ""}`);
  }
} else if (cmd === "add") {
  const n = await store.adjustStock(need(a), int(b));
  console.log(n === null ? "Refused: that would take stock below zero." : `${a} is now ${n}`);
} else if (cmd === "set") {
  const n = int(b);
  if (n < 0) { console.error("Stock can't be negative."); process.exit(1); }
  await store.setStock({ [need(a)]: n });
  console.log(`${a} set to ${n}`);
} else if (cmd === "seed") {
  const n = int(a);
  if (n < 0 || process.argv[4] !== "--yes") { console.error("Usage: pnpm inventory seed <N> --yes"); process.exit(1); }
  const existing = await store.getStock(skus);
  const stocked = skus.filter((s) => existing[s] !== null);
  if (stocked.length) { console.error(`Refusing to overwrite existing stock for ${stocked.length} SKU(s). Use "add" or "set" per SKU.`); process.exit(1); }
  await store.setStock(Object.fromEntries(skus.map((s) => [s, n])));
  console.log(`Seeded ${skus.length} SKUs with ${n} each.`);
} else {
  console.error("Commands: show | orders [N] | add <SKU> <+N|-N> | set <SKU> <N> | seed <N> --yes");
  process.exit(1);
}
process.exit(0);
