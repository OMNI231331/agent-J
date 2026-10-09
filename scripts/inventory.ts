// Inventory admin for Upstash Redis.  Usage (reads .env.local if present):
//   pnpm inventory show                  list every SKU and its live count
//   pnpm inventory add  <SKU> <+N|-N>    restock / correct relative to live stock (safe while customers are checking out)
//   pnpm inventory set  <SKU> <N>        absolute count (ONLY before launch or when no checkouts are open)
//   pnpm inventory orders [N]            most recent orders (paid / awaiting_payment / payment_failed / needs_attention)
//   pnpm inventory fulfill <session_id> shipped|cancelled [tracking]   mark a paid order shipped or cancelled
//   pnpm inventory reconcile [--days N] [--apply]   compare Stripe's completed sessions with the orders here; --apply rebuilds missing ones
//   pnpm inventory seed <N> --yes        set every purchasable SKU to N (first-time setup only; refuses if any SKU already has stock)
import { allSkus, findSku } from "../lib/catalog.ts";
import { getStore } from "../lib/commerce/redis.ts";
import { listCompletedSessions, reconcile } from "../lib/commerce/reconcile.ts";
import { stripeClient, stripeMode } from "../lib/commerce/stripe.ts";

const store = getStore();
if (!store) {
  console.error("Redis isn't configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN) — see docs/CHECKOUT.md.");
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
    const ship = o.details.shipping;
    const addr = ship ? [ship.name, ship.address.line1, ship.address.line2, ship.address.city, ship.address.state, ship.address.postal_code, ship.address.country].filter(Boolean).join(", ") : "-";
    console.log(
      `${new Date(o.createdAt).toISOString()}  ${o.status.padEnd(16)} ${total.padStart(9)}  ${o.details.email ?? "-"}  ${items}\n` +
        `    session ${o.sessionId}  payment ${o.details.paymentIntent ?? "-"}  fulfilment ${o.fulfillment ?? "-"}${o.tracking ? " (" + o.tracking + ")" : ""}\n` +
        `    ship to: ${addr}${o.details.note ? "\n    NOTE: " + o.details.note : ""}`,
    );
  }
} else if (cmd === "fulfill") {
  if (!a || (b !== "shipped" && b !== "cancelled")) { console.error("Usage: pnpm inventory fulfill <session_id> shipped|cancelled [tracking]"); process.exit(1); }
  const out = await store.setFulfilment(a, b, Date.now(), process.argv[5] ?? "");
  console.log(out === "ok" ? `${a} marked ${b}` : out === "unchanged" ? `${a} is already ${b}` : `Refused: ${out}`);
  if (out !== "ok" && out !== "unchanged") process.exit(1);
} else if (cmd === "reconcile") {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || stripeMode(key) === "invalid") { console.error("Set STRIPE_SECRET_KEY (test or live) to reconcile with Stripe."); process.exit(1); }
  const days = process.argv.includes("--days") ? int(process.argv[process.argv.indexOf("--days") + 1]) : 7;
  const apply = process.argv.includes("--apply");
  const sessions = await listCompletedSessions(key, Math.floor(Date.now() / 1000) - days * 86400);
  // With --apply the replay behaves exactly like the webhook, including refunding a lost payment whose stock was resold.
  const r = await reconcile(store, sessions, { apply, refunds: apply ? stripeClient(key) : undefined });
  console.log(`Stripe completed sessions in the last ${days} day(s): ${sessions.length} (${r.skipped} not from this store)`);
  console.log(`  consistent: ${r.ok}   missing in Redis: ${r.missing.length}   mismatched: ${r.mismatched.length}   repaired: ${r.repaired.length}`);
  for (const id of r.missing) console.log(`  MISSING   ${id}`);
  for (const m of r.mismatched) console.log(`  MISMATCH  ${m.sessionId}: ${m.problem}`);
  if (!apply && (r.missing.length || r.mismatched.length)) console.log('  Re-run with --apply to rebuild missing/behind orders (safe to repeat). Amount differences are never auto-changed.');
  if (r.missing.length + r.mismatched.length > r.repaired.length) process.exit(2);
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
  console.error("Commands: show | orders [N] | fulfill <session_id> shipped|cancelled [tracking] | reconcile [--days N] [--apply] | add <SKU> <+N|-N> | set <SKU> <N> | seed <N> --yes");
  process.exit(1);
}
process.exit(0);
