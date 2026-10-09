// End-to-end purchase test against the REAL built app: next start + real @upstash/redis client
// (via a local Upstash-protocol shim over redis-server) + a fake Stripe HTTP server.
// Run: pnpm build && node scripts/smoke-test.ts
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
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
const sessions = new Map<string, { id: string; status: string; params: URLSearchParams; object?: Record<string, unknown> }>();
const refundsMade: { body: URLSearchParams; idem: string | undefined }[] = [];
let failNextRefund = false;
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
    if (req.method === "POST" && url.pathname === "/v1/refunds") {
      if (failNextRefund) { failNextRefund = false; return void res.writeHead(500).end(JSON.stringify({ error: { message: "temporary Stripe error" } })); }
      refundsMade.push({ body: new URLSearchParams(body), idem: req.headers["idempotency-key"] as string | undefined });
      return void res.end(JSON.stringify({ id: `re_test_${refundsMade.length}` }));
    }
    if (req.method === "GET" && url.pathname === "/v1/checkout/sessions") {
      const done = [...sessions.values()].filter((s) => s.status === "complete").map((s) => s.object ?? { id: s.id, status: s.status });
      return void res.end(JSON.stringify({ data: done, has_more: false }));
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
  const SHIP = { name: "Smoke Buyer", address: { line1: "1 Smoke Street", city: "Austin", state: "TX", postal_code: "78701", country: "US" } };
  const paid = { id: "evt_paid_1", type: "checkout.session.completed", data: { object: { id: "", status: "complete", metadata: { reservation_id: "" }, payment_status: "paid", amount_total: 12500, amount_subtotal: 12500, currency: "usd", payment_intent: "pi_smoke_1", customer_details: { email: "buyer@example.com", name: "Smoke Buyer" }, collected_information: { shipping_details: SHIP } } } };
  // Async on purpose: this process hosts the fake Stripe and the Upstash shim the CLI calls, so it must not block while the CLI runs.
  const cli = (...args: string[]) =>
    new Promise<{ status: number; stdout: string; stderr: string }>((resolve) =>
      execFile("node", ["scripts/inventory.ts", ...args], { encoding: "utf8", timeout: 30_000, env: { ...process.env, UPSTASH_REDIS_REST_URL: shim.url, UPSTASH_REDIS_REST_TOKEN: TOKEN, STRIPE_SECRET_KEY: "sk_test_smoke", STRIPE_API_BASE: `http://127.0.0.1:${stripePort}/v1` } }, (err, stdout, stderr) =>
        resolve({ status: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout, stderr })));
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
  await step("the order records the shipping address, payment id, items and an unfulfilled status", async () => {
    const o = (await store.getOrder(sessionId))!;
    assert.equal(o.fulfillment, "unfulfilled");
    assert.equal(o.details.paymentIntent, "pi_smoke_1");
    assert.equal(o.details.shipping?.address.city, "Austin");
    assert.equal(o.details.items?.[0].sku, SKU);
    assert.equal(o.details.amountSubtotal, 12500);
    sessions.get(sessionId)!.status = "complete"; // Stripe now reports this session as complete
    sessions.get(sessionId)!.object = paid.data.object;
  });
  await step("CLI: 'orders' shows the shipping address, payment id and fulfilment", async () => {
    const r = await cli("orders");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /pi_smoke_1/);
    assert.match(r.stdout, /Austin/);
    assert.match(r.stdout, /fulfilment unfulfilled/);
  });
  await step("CLI: 'reconcile' finds a paid Stripe session with no order, and --apply rebuilds it safely", async () => {
    const id = "00000000-0000-4000-8000-0000000000bb";
    await store.setStock({ [SKU]: 5 });
    assert.deepEqual(await store.reserve(id, [{ sku: SKU, qty: 2 }], Date.now() + 3_600_000), { ok: true }); // customer paid, but our webhook never arrived
    sessions.set("cs_lost_1", { id: "cs_lost_1", status: "complete", params: new URLSearchParams(), object: { id: "cs_lost_1", status: "complete", payment_status: "paid", metadata: { reservation_id: id }, amount_total: 25000, amount_subtotal: 25000, currency: "usd", payment_intent: "pi_lost_1", customer_details: { email: "lost@example.com" }, collected_information: { shipping_details: SHIP } } });
    const dry = await cli("reconcile", "--days", "1");
    assert.equal(dry.status, 2, "exit code 2 = needs attention");
    assert.match(dry.stdout, /MISSING\s+cs_lost_1/);
    assert.equal(await store.getOrder("cs_lost_1"), null, "a dry run changes nothing");
    const fix = await cli("reconcile", "--days", "1", "--apply");
    assert.equal(fix.status, 0, fix.stdout + fix.stderr);
    assert.equal((await store.getOrder("cs_lost_1"))?.status, "paid");
    assert.equal(await stock(), 3, "5 - 2 reserved, deducted once");
    const again = await cli("reconcile", "--days", "1", "--apply");
    assert.equal(again.status, 0);
    assert.match(again.stdout, /missing in Redis: 0/);
    assert.equal(await stock(), 3);
    assert.equal(Number(await admin.command("ZCARD", "lsw:orders")), 2);
    await store.setStock({ [SKU]: 1 });
  });
  await step("CLI: 'fulfill' marks a paid order shipped, and refuses an unpaid one", async () => {
    const ok = await cli("fulfill", sessionId, "shipped", "TRACK123");
    assert.equal(ok.status, 0, ok.stderr);
    const o = (await store.getOrder(sessionId))!;
    assert.equal(o.fulfillment, "shipped");
    assert.equal(o.tracking, "TRACK123");
    assert.equal((await cli("fulfill", "cs_does_not_exist", "shipped")).status, 1);
  });
  await step("success page shows the confirmed order", async () => {
    const html = await (await fetch(`${B}/checkout/success?session_id=${sessionId}`)).text();
    assert.match(html, /Order confirmed/);
  });
  await step("cancelling a second checkout expires the session and returns stock", async () => {
    const r = await post("/api/checkout", { lines: [{ sku: SKU, qty: 1 }] });
    assert.equal(r.status, 200);
    assert.equal(await stock(), 0);
    const sid = [...sessions.keys()].filter((k) => k.startsWith("cs_test_")).pop()!; // the session this checkout just created
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
  await step("checkout starts are rate-limited per IP (invalid carts don't count)", async () => {
    for (let i = 0; i < 12; i++) assert.equal((await post("/api/checkout", { lines: [] }, { "x-forwarded-for": "203.0.113.9" })).status, 400, "malformed carts must never use up the limit");
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await post("/api/checkout", { lines: [{ sku: SKU, qty: 1 }] }, { "x-forwarded-for": "203.0.113.9" })).status;
    assert.equal(last, 429);
    assert.equal((await post("/api/checkout", { lines: [{ sku: SKU, qty: 1 }] }, { "x-forwarded-for": "203.0.113.10" })).status !== 429, true, "other IPs are unaffected");
    await store.setStock({ [SKU]: 1 }); // earlier attempts may have reserved stock; reset for the next steps
  });
  await step("platform-set IP header wins over a spoofed x-forwarded-for", async () => {
    // 12 requests, each with a different spoofed x-forwarded-for but the same trusted x-vercel-forwarded-for
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await post("/api/checkout", { lines: [{ sku: SKU, qty: 1 }] }, { "x-vercel-forwarded-for": "203.0.113.50", "x-forwarded-for": `10.9.8.${i}` })).status;
    assert.equal(last, 429, "rotating x-forwarded-for must not bypass the limit");
    await store.setStock({ [SKU]: 1 });
  });
  await step("an order over 6 items is rejected", async () => {
    const r = await post("/api/checkout", { lines: [{ sku: SKU, qty: 3 }, { sku: "LSW001-HOOD-WASHED-BLACK-L", qty: 3 }, { sku: "LSW001-TEE-WASHED-BLACK-M", qty: 1 }] }, { "x-forwarded-for": "203.0.113.60" });
    assert.equal(r.status, 409);
  });
  await step("branded 404 page, robots.txt, sitemap.xml and security headers", async () => {
    const nf = await fetch(`${B}/definitely-not-a-page`);
    assert.equal(nf.status, 404);
    const html = await nf.text();
    assert.match(html, /Page not found/); assert.match(html, /Back to the shop/); assert.match(html, /<header/);
    const robots = await (await fetch(`${B}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/api\//); assert.match(robots, /Sitemap:/);
    const map = await (await fetch(`${B}/sitemap.xml`)).text();
    assert.match(map, /\/products\/signature-hoodie/); assert.doesNotMatch(map, /\/brand|\/api\//);
    const h = (await fetch(`${B}/shop`)).headers;
    assert.equal(h.get("x-content-type-options"), "nosniff"); assert.equal(h.get("x-frame-options"), "SAMEORIGIN"); assert.equal(h.get("x-powered-by"), null);
  });
  await step("draft price is labelled on listing pages; canonical and noindex are set", async () => {
    const shop = await (await fetch(`${B}/shop?category=Hoodies&sort=price-desc`)).text();
    assert.match(shop, /Draft price/);
    assert.match(shop, /rel="canonical" href="[^"]*\/shop"/, "filtered/sorted shop URLs must canonicalise to /shop");
    assert.match(await (await fetch(`${B}/assistant`)).text(), /noindex/);
  });
  await step("late payment after sell-out: first refund attempt fails, Stripe's retry refunds the customer exactly once", async () => {
    await store.setStock({ [SKU]: 1 });
    const mk = async () => { const r = await post("/api/checkout", { lines: [{ sku: SKU, qty: 1 }] }, { "x-forwarded-for": `198.51.100.${sessions.size + 20}` }); assert.equal(r.status, 200); const sid = [...sessions.keys()].at(-1)!; return { sid, rid: sessions.get(sid)!.params.get("metadata[reservation_id]")! }; };
    const a = await mk();                                   // buyer A reserves the last unit...
    await store.release(a.rid, "test-hold-expired");        // ...their hold expires and the unit returns to stock
    await mk();                                             // buyer B takes it
    assert.equal(await stock(), 0);
    const evt = { id: "evt_late_1", type: "checkout.session.completed", data: { object: { id: a.sid, metadata: { reservation_id: a.rid }, payment_status: "paid", payment_intent: "pi_smoke_1", amount_subtotal: 12500, amount_total: 12500, currency: "usd" } } };
    failNextRefund = true;
    assert.equal((await webhook(evt)).status, 500, "a failed refund must make Stripe retry");
    assert.equal(refundsMade.length, 0);
    assert.equal((await webhook(evt)).status, 200);          // Stripe redelivers the same event
    assert.equal(refundsMade.length, 1);
    assert.equal(refundsMade[0].body.get("payment_intent"), "pi_smoke_1");
    assert.equal(refundsMade[0].idem, `refund_${a.rid}`);
    assert.equal((await store.getOrder(a.sid))?.status, "refunded");
    assert.equal((await webhook(evt)).status, 200);          // and a further duplicate does nothing
    assert.equal(refundsMade.length, 1);
    assert.equal(await stock(), 0);
    await store.setStock({ [SKU]: 1 });
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
