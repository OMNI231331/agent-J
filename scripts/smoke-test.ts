// End-to-end purchase test against the REAL built app: next start + real @upstash/redis client
// (via a local Upstash-protocol shim over redis-server) + a fake Stripe HTTP server.
// Run: pnpm build && node scripts/smoke-test.ts
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import http from "node:http";
import { createHmac } from "node:crypto";
import { startRedis, RespClient } from "../tests/redis-harness.ts";
import { startUpstashShim } from "../tests/upstash-shim.ts";
import { InventoryStore } from "../lib/commerce/store.ts";
import { signStripePayload } from "../lib/commerce/stripe.ts";

const WHSEC = "whsec_smoke", CRON = "cron_smoke", TOKEN = "tok_smoke", APP_PORT = 3000; // 3000 = host allowed by the existing eve auth config
const SKU = "LSW001-HOOD-WASHED-BLACK-M";

// ---- fake Stripe
const sessions = new Map<string, { id: string; status: string; params: URLSearchParams }>();
const stripe = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url!, "http://x");
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer sk_test_smoke") return void res.writeHead(401).end("{}");
    if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
      const id = `cs_test_${sessions.size + 1}`;
      sessions.set(id, { id, status: "open", params: new URLSearchParams(body) });
      return void res.end(JSON.stringify({ id, url: `https://checkout.stripe.test/${id}`, status: "open" }));
    }
    const m = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/);
    const s = m && sessions.get(m[1]);
    if (!s) return void res.writeHead(404).end(JSON.stringify({ error: { message: "no such session" } }));
    if (m![2]) s.status = "expired";
    res.end(JSON.stringify({ id: s.id, status: s.status }));
  });
});
await new Promise<void>((r) => stripe.listen(0, "127.0.0.1", r));
const stripePort = (stripe.address() as { port: number }).port;

// ---- redis + upstash shim + app
const redis = await startRedis();
const shim = await startUpstashShim(redis.port, TOKEN);
const admin = new RespClient(redis.port);
await admin.ready();
const store = new InventoryStore(admin);
await store.setStock({ [SKU]: 2 });

const app = spawn("pnpm", ["start", "-p", String(APP_PORT)], {
  detached: true, // own process group, so cleanup also stops the Next server that pnpm launches
  env: { ...process.env, VERCEL_URL: `localhost:${APP_PORT}`, BETTER_AUTH_SECRET: "smoke-secret-0123456789abcdef", VERCEL_APP_CLIENT_ID: "x", VERCEL_APP_CLIENT_SECRET: "x",
    UPSTASH_REDIS_REST_URL: shim.url, UPSTASH_REDIS_REST_TOKEN: TOKEN, STRIPE_SECRET_KEY: "sk_test_smoke", STRIPE_API_BASE: `http://127.0.0.1:${stripePort}/v1`,
    STRIPE_WEBHOOK_SECRET: WHSEC, CRON_SECRET: CRON, NEXT_PUBLIC_STORE_MODE: "preview" },
  stdio: ["ignore", openSync(process.env.SMOKE_LOG ?? "/dev/null", "w"), openSync(process.env.SMOKE_LOG ?? "/dev/null", "a")],
});
const B = `http://localhost:${APP_PORT}`;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(B + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const webhook = (event: object, secret = WHSEC) => { const raw = JSON.stringify(event); return post("/api/stripe/webhook", raw, { "stripe-signature": signStripePayload(raw, secret) }); };
const stock = async () => (await store.getStock([SKU]))[SKU];
let failed = 0;
const step = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log("  ✓", name); } catch (e) { failed++; console.log("  ✗", name, "\n   ", e instanceof Error ? e.message : e); } };

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(B + "/api/stripe/webhook")).status) break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
  console.log("Smoke test: full purchase flow");
  let resId = "", sessionId = "";

  await step("checkout validates input on the server", async () => {
    assert.equal((await post("/api/checkout", { lines: [] })).status, 400);
    assert.equal((await post("/api/checkout", { lines: [{ sku: "FAKE", qty: 1 }] })).status, 400);
    assert.equal((await post("/api/checkout", { lines: [{ sku: SKU, qty: 1, priceCents: 1 }] })).status, 409);
    assert.equal(await stock(), 2, "rejected carts must not touch stock");
  });
  await step("checkout reserves stock and returns a Stripe URL", async () => {
    const r = await post("/api/checkout", { lines: [{ sku: SKU, qty: 1, priceCents: 12500 }] });
    assert.equal(r.status, 200);
    assert.match((await r.json() as { url: string }).url, /^https:\/\/checkout\.stripe\.test\/cs_test_/);
    sessionId = [...sessions.keys()][0];
    resId = sessions.get(sessionId)!.params.get("metadata[reservation_id]")!;
    assert.equal(sessions.get(sessionId)!.params.get("line_items[0][price_data][unit_amount]"), "12500");
    assert.equal(await stock(), 1);
  });
  await step("a second buyer cannot take more than what's left", async () => {
    const r = await post("/api/checkout", { lines: [{ sku: SKU, qty: 2 }] });
    assert.equal(r.status, 409);
    assert.equal(await stock(), 1);
  });
  await step("webhook rejects missing / forged signatures", async () => {
    assert.equal((await post("/api/stripe/webhook", "{}")).status, 400);
    assert.equal((await webhook({ id: "evt_forged", type: "checkout.session.completed", data: { object: { id: sessionId, metadata: { reservation_id: resId }, payment_status: "paid" } } }, "whsec_wrong")).status, 400);
    assert.equal((await store.getOrder(sessionId)), null);
  });
  const paid = { id: "evt_paid_1", type: "checkout.session.completed", data: { object: { id: "", metadata: { reservation_id: "" }, payment_status: "paid", amount_total: 12500, currency: "usd", customer_details: { email: "buyer@example.com" } } } };
  await step("a signed 'paid' webhook creates the order and keeps the stock deducted", async () => {
    paid.data.object.id = sessionId; paid.data.object.metadata.reservation_id = resId;
    const r = await webhook(paid);
    assert.equal(r.status, 200);
    assert.equal((await store.getOrder(sessionId))?.status, "paid");
    assert.equal(await stock(), 1);
  });
  await step("the same webhook delivered again changes nothing", async () => {
    const r = await webhook(paid);
    assert.equal(r.status, 200);
    assert.equal(((await r.json()) as { duplicate?: boolean }).duplicate, true);
    assert.equal(await stock(), 1);
    assert.equal(Number(await admin.command("ZCARD", "lsw:orders")), 1);
  });
  await step("success page shows the confirmed order", async () => {
    const html = await (await fetch(`${B}/checkout/success?session_id=${sessionId}`)).text();
    assert.match(html, /Order confirmed/);
  });
  await step("cancelling a second checkout expires the session and returns stock", async () => {
    const r = await post("/api/checkout", { lines: [{ sku: SKU, qty: 1 }] });
    assert.equal(r.status, 200);
    assert.equal(await stock(), 0);
    const sid = [...sessions.keys()][1];
    const rid = sessions.get(sid)!.params.get("metadata[reservation_id]")!;
    const c = await post("/api/checkout/cancel", { reservationId: rid });
    assert.equal(((await c.json()) as { outcome: string }).outcome, "released");
    assert.equal(sessions.get(sid)!.status, "expired");
    assert.equal(await stock(), 1);
  });
  await step("product page reflects live stock (sold out → 'Out of stock')", async () => {
    await store.setStock({ [SKU]: 0 });
    const html = await (await fetch(`${B}/products/signature-hoodie`)).text();
    assert.ok(html.includes("line-through"), "sold-out size should be struck through");
    await store.setStock({ [SKU]: 1 });
  });
  await step("checkout starts are rate-limited per IP", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await post("/api/checkout", { lines: [] }, { "x-forwarded-for": "203.0.113.9" })).status;
    assert.equal(last, 429);
    assert.equal((await post("/api/checkout", { lines: [] }, { "x-forwarded-for": "203.0.113.10" })).status, 400, "other IPs are unaffected");
  });
  await step("cron endpoint requires its secret and releases expired holds", async () => {
    assert.equal((await fetch(`${B}/api/cron/release-reservations`)).status, 401);
    const id = "00000000-0000-4000-8000-0000000000aa";
    await store.reserve(id, [{ sku: SKU, qty: 1 }], Date.now() - 5000);
    assert.equal(await stock(), 0);
    const r = await fetch(`${B}/api/cron/release-reservations`, { headers: { authorization: `Bearer ${CRON}` } });
    assert.equal(((await r.json()) as { released: number }).released, 1);
    assert.equal(await stock(), 1);
  });
} finally {
  try { process.kill(-app.pid!); } catch { /* already gone */ }
  stripe.close(); shim.close(); admin.close(); redis.stop();
}
console.log(failed ? `\n${failed} step(s) FAILED` : "\nAll smoke-test steps passed");
process.exit(failed ? 1 : 0);
