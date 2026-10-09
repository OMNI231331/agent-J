// Regression and gap-closing tests from the PR #3 audit: server-side validation, route behaviour, Redis outages,
// half-finished webhooks, order completeness, status ordering and Stripe reconciliation.
// Everything runs against a real redis-server (the production Lua scripts run for real); Stripe is faked.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { findSku, MAX_PER_LINE } from "../lib/catalog.ts";
import type { CommerceConfig } from "../lib/commerce/config.ts";
import { handleCheckoutRequest, handleWebhookRequest, resolveOrigin } from "../lib/commerce/http.ts";
import { listCompletedSessions, reconcile } from "../lib/commerce/reconcile.ts";
import * as S from "../lib/commerce/scripts.ts";
import { InventoryStore, type RedisLike } from "../lib/commerce/store.ts";
import { signStripePayload, type CheckoutSession, type StripeApi } from "../lib/commerce/stripe.ts";
import { validateCart } from "../lib/commerce/validate.ts";
import { handleStripeEvent, type StripeEvent } from "../lib/commerce/webhook.ts";
import { RespClient, startRedis } from "./redis-harness.ts";

const HOODIE = "LSW001-HOOD-WASHED-BLACK-M";
const TEE = "LSW001-TEE-WASHED-BLACK-M";
const CONCEPT = "LSW001-STMT-BLACK-M";
const SECRET = "whsec_hardening";

/** Wraps the real client so tests can simulate Redis being down, or failing at one specific step. */
class FlakyRedis implements RedisLike {
  down = false;
  failOnce: string | null = null; // script text to fail the next time it runs
  failAlways = new Set<string>(); // script texts that fail every time until removed
  private readonly inner: RespClient;
  constructor(inner: RespClient) {
    this.inner = inner;
  }
  async eval(script: string, keys: string[], args: string[]) {
    if (this.down) throw new Error("connect ECONNREFUSED 10.0.0.1:6379 (token=SECRET-TOKEN-VALUE)");
    if (this.failAlways.has(script)) throw new Error("simulated Redis failure (persistent)");
    if (this.failOnce === script) {
      this.failOnce = null;
      throw new Error("simulated Redis failure");
    }
    return this.inner.eval(script, keys, args);
  }
}

let redis: Awaited<ReturnType<typeof startRedis>>;
let client: RespClient;
let flaky: FlakyRedis;
let store: InventoryStore;

before(async () => {
  redis = await startRedis();
  client = new RespClient(redis.port);
  await client.ready();
  flaky = new FlakyRedis(client);
  store = new InventoryStore(flaky);
});
after(() => {
  client.close();
  redis.stop();
});
beforeEach(async () => {
  flaky.down = false;
  flaky.failOnce = null;
  flaky.failAlways.clear();
  await client.command("FLUSHALL");
});

const stock = async (sku: string) => (await store.getStock([sku]))[sku];
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const logs: Record<string, unknown>[] = [];
const log = (e: Record<string, unknown>) => void logs.push(e);

function fakeStripe() {
  const calls = { created: [] as URLSearchParams[], n: 0 };
  const api: StripeApi = {
    async createCheckoutSession(params) {
      calls.created.push(params);
      calls.n++;
      return { id: `cs_test_${calls.n}`, url: `https://checkout.stripe.test/cs_test_${calls.n}` };
    },
    async retrieveCheckoutSession(id) {
      return { id, status: "open" };
    },
    async expireCheckoutSession(id) {
      return { id, status: "expired" };
    },
    async createRefund() {
      throw new Error("not used here");
    },
  };
  return { api, calls };
}
const okCfg = (api: StripeApi): CommerceConfig => ({ ok: true, store, stripe: api, mode: "test" });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://lsw.test/api/checkout", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

const paidSession = (over: Partial<CheckoutSession> = {}): CheckoutSession => ({
  id: "cs_test_paid",
  status: "complete",
  payment_status: "paid",
  amount_total: 12500,
  amount_subtotal: 12500,
  currency: "usd",
  payment_intent: "pi_test_123",
  customer_details: { email: "buyer@example.com", name: "Test Buyer" },
  collected_information: { shipping_details: { name: "Test Buyer", address: { line1: "1 Test Street", city: "Austin", state: "TX", postal_code: "78701", country: "US" } } },
  ...over,
});
const ev = (type: string, session: CheckoutSession, id = `evt_${++seq}`): StripeEvent => ({ id, type, data: { object: session } });
const signed = (e: StripeEvent, secret = SECRET) => {
  const raw = JSON.stringify(e);
  return { raw, headers: { "stripe-signature": signStripePayload(raw, secret) } };
};
const webhookReq = (raw: string, headers: Record<string, string>) => new Request("https://lsw.test/api/stripe/webhook", { method: "POST", headers, body: raw });
const FUTURE = () => Date.now() + 3_600_000;

// Reserve through the real store, then build the session Stripe would later report for it.
async function reserved(sku = HOODIE, qty = 1, sessionId = "cs_test_paid") {
  const id = uuid();
  assert.deepEqual(await store.reserve(id, [{ sku, qty }], FUTURE()), { ok: true });
  const subtotal = findSku(sku)!.product.priceCents * qty;
  await store.attachSession(id, sessionId, subtotal); // the subtotal reserved at catalog prices
  // What Stripe would report for this reservation: it charged exactly the reserved subtotal.
  return { id, session: paidSession({ id: sessionId, metadata: { reservation_id: id }, client_reference_id: id, amount_subtotal: subtotal, amount_total: subtotal }) };
}

// ---------------------------------------------------------------- 1. server-side validation
describe("cart validation: nothing from the browser is trusted", () => {
  const bad: [string, unknown, number][] = [
    ["not an array", { sku: HOODIE, qty: 1 }, 400],
    ["empty bag", [], 400],
    ["more than 20 lines", Array.from({ length: 21 }, () => ({ sku: HOODIE, qty: 1 })), 400],
    ["a null line", [null], 400],
    ["a made-up product ID", [{ sku: "LSW999-FREE-HOODIE", qty: 1 }], 400],
    ["a size that does not exist (SKU edited)", [{ sku: "LSW001-HOOD-WASHED-BLACK-XXXL", qty: 1 }], 400],
    ["a colour that does not exist (SKU edited)", [{ sku: "LSW001-HOOD-PINK-M", qty: 1 }], 400],
    ["quantity as a string", [{ sku: HOODIE, qty: "2" }], 400],
    ["quantity 0", [{ sku: HOODIE, qty: 0 }], 400],
    ["negative quantity", [{ sku: HOODIE, qty: -1 }], 400],
    ["fractional quantity", [{ sku: HOODIE, qty: 1.5 }], 400],
    ["infinite quantity", [{ sku: HOODIE, qty: Infinity }], 400],
    ["quantity over the per-item limit", [{ sku: HOODIE, qty: MAX_PER_LINE + 1 }], 409],
    ["per-item limit exceeded by merging duplicate lines", [{ sku: HOODIE, qty: MAX_PER_LINE }, { sku: HOODIE, qty: 1 }], 409],
    ["a concept product that is not for sale", [{ sku: CONCEPT, qty: 1 }], 409],
    ["a tampered price", [{ sku: HOODIE, qty: 1, priceCents: 100 }], 409],
    ["a colour that does not match the SKU", [{ sku: HOODIE, qty: 1, color: "charcoal" }], 400],
    ["a size that does not match the SKU", [{ sku: HOODIE, qty: 1, size: "XL" }], 400],
  ];
  for (const [name, input, status] of bad)
    test(`rejects ${name}`, () => {
      const r = validateCart(input, { liveMode: false });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.status, status);
    });

  test("accepts displayed values that match the catalog", () => {
    assert.equal(validateCart([{ sku: HOODIE, qty: 1, priceCents: 12500, color: "washed-black", size: "M" }], { liveMode: false }).ok, true);
  });

  test("a rejected cart reserves nothing and never reaches Stripe", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const s = fakeStripe();
    const res = await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 1, priceCents: 1 }] }), { cfg: okCfg(s.api), liveMode: false, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 409);
    assert.equal(s.calls.n, 0);
    assert.equal(await stock(HOODIE), 5);
  });
});

// ---------------------------------------------------------------- 2. checkout route behaviour
describe("checkout route", () => {
  beforeEach(async () => void (await store.setStock({ [HOODIE]: 100 })));

  test("not configured answers 503 with the setup message and touches nothing", async () => {
    const res = await handleCheckoutRequest(post({ lines: [] }), { cfg: { ok: false, error: "Checkout isn't connected yet." }, liveMode: false, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 503);
  });

  test("a malformed body is a 400, not a crash", async () => {
    const res = await handleCheckoutRequest(post("{not json"), { cfg: okCfg(fakeStripe().api), liveMode: false, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 400);
  });

  test("valid cart: stock is reserved and the customer gets a Stripe URL", async () => {
    const s = fakeStripe();
    const res = await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 2 }] }), { cfg: okCfg(s.api), liveMode: false, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 200);
    assert.match(((await res.json()) as { url: string }).url, /^https:\/\/checkout\.stripe\.test\//);
    assert.equal(await stock(HOODIE), 98);
  });

  test("9th checkout start from one IP in the window is rate-limited; another IP is unaffected", async () => {
    const s = fakeStripe();
    const d = { cfg: okCfg(s.api), liveMode: false, requestOrigin: "https://lsw.test", log };
    const codes: number[] = [];
    for (let i = 0; i < 9; i++) codes.push((await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 1 }] }, { "x-forwarded-for": "203.0.113.5" }), d)).status);
    assert.deepEqual(codes, [200, 200, 200, 200, 200, 200, 200, 200, 429]);
    assert.equal((await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 1 }] }, { "x-forwarded-for": "203.0.113.6" }), d)).status, 200);
  });

  test("Redis connection failure: a safe 503, no stack, no credentials, nothing charged", async () => {
    flaky.down = true;
    logs.length = 0;
    const s = fakeStripe();
    const res = await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 1 }] }), { cfg: okCfg(s.api), liveMode: false, requestOrigin: "https://lsw.test", log });
    const text = await res.text();
    assert.equal(res.status, 503);
    assert.match(text, /temporarily unavailable/);
    assert.doesNotMatch(text, /ECONNREFUSED|SECRET-TOKEN|at .*\.ts/);
    assert.equal(s.calls.n, 0, "Stripe must not be called when stock can't be reserved");
  });

  test("Redis failing right after Stripe creates the session: a clean error and the stock is returned immediately", async () => {
    const s = fakeStripe();
    flaky.failOnce = S.HSET; // attaching the session id to the reservation fails
    const res = await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 2 }] }), { cfg: okCfg(s.api), liveMode: false, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 502);
    assert.doesNotMatch(await res.text(), /simulated Redis failure/);
    assert.equal(await stock(HOODIE), 100, "the customer never received a checkout URL, so the hold is released straight away");
  });

  test("if Redis also fails to release, the stock is held only until the hold expires, then the sweeper returns it", async () => {
    const s = fakeStripe();
    flaky.failAlways.add(S.HSET).add(S.RELEASE);
    const res = await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 2 }] }), { cfg: okCfg(s.api), liveMode: false, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 502);
    assert.equal(await stock(HOODIE), 98, "still held: release could not run");
    flaky.failAlways.clear();
    assert.equal(await store.sweepExpired(Date.now() + 2 * 60 * 60 * 1000), 1);
    assert.equal(await stock(HOODIE), 100, "abandoned hold is returned, nothing leaks permanently");
  });

  test("redirect origin: live mode requires the configured https URL and ignores the request's origin", () => {
    assert.equal(resolveOrigin({ liveMode: true, siteUrl: "https://lsw.example/", requestOrigin: "https://evil.example" }), "https://lsw.example");
    assert.equal(resolveOrigin({ liveMode: true, siteUrl: undefined, requestOrigin: "https://lsw.example" }), null);
    assert.equal(resolveOrigin({ liveMode: true, siteUrl: "http://lsw.example", requestOrigin: "https://lsw.example" }), null);
    assert.equal(resolveOrigin({ liveMode: true, siteUrl: "https://lsw.example/path", requestOrigin: "x" }), null);
    assert.equal(resolveOrigin({ liveMode: false, siteUrl: undefined, requestOrigin: "http://localhost:3000" }), "http://localhost:3000");
    assert.equal(resolveOrigin({ liveMode: false, siteUrl: "https://preview.lsw.example", requestOrigin: "http://localhost:3000" }), "https://preview.lsw.example");
  });

  test("live mode without an https site URL refuses to start checkout", async () => {
    const res = await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 1 }] }), { cfg: okCfg(fakeStripe().api), liveMode: true, requestOrigin: "https://lsw.test", log });
    assert.equal(res.status, 503);
  });

  test("Stripe return URLs use the configured site URL", async () => {
    const s = fakeStripe();
    await handleCheckoutRequest(post({ lines: [{ sku: HOODIE, qty: 1 }] }), { cfg: okCfg(s.api), liveMode: false, siteUrl: "https://preview.lsw.example", requestOrigin: "https://evil.example", log });
    const p = s.calls.created[0];
    assert.ok(p.get("success_url")!.startsWith("https://preview.lsw.example/checkout/success"));
    assert.ok(p.get("cancel_url")!.startsWith("https://preview.lsw.example/checkout/cancelled"));
  });
});

// ---------------------------------------------------------------- 3. webhook route behaviour
describe("webhook route", () => {
  test("not configured: 503 so Stripe retries later", async () => {
    const e = signed(ev("checkout.session.completed", paidSession()));
    assert.equal((await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: undefined, store, log })).status, 503);
    assert.equal((await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store: null, log })).status, 503);
  });

  test("a missing, forged or tampered signature is a 400 and changes nothing", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { id, session } = await reserved();
    const e = signed(ev("checkout.session.completed", session));
    logs.length = 0;
    assert.equal((await handleWebhookRequest(webhookReq(e.raw, {}), { secret: SECRET, store, log })).status, 400);
    const forged = signed(ev("checkout.session.completed", session), "whsec_attacker");
    assert.equal((await handleWebhookRequest(webhookReq(forged.raw, forged.headers), { secret: SECRET, store, log })).status, 400);
    assert.equal((await handleWebhookRequest(webhookReq(e.raw.replace("cs_test_paid", "cs_test_evil"), e.headers), { secret: SECRET, store, log })).status, 400);
    assert.equal(await store.getOrder("cs_test_paid"), null);
    assert.equal((await store.getReservation(id))?.status, "reserved");
    assert.ok(logs.some((l) => l.evt === "webhook_rejected"));
    assert.doesNotMatch(JSON.stringify(logs), /buyer@example\.com|cs_test_evil/);
  });

  test("a validly signed but malformed payload is a 400", async () => {
    const raw = "this is not json";
    const res = await handleWebhookRequest(webhookReq(raw, { "stripe-signature": signStripePayload(raw, SECRET) }), { secret: SECRET, store, log });
    assert.equal(res.status, 400);
  });

  test("paid event over the route creates the order; replaying it is acknowledged and changes nothing", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { id, session } = await reserved();
    assert.equal(await stock(HOODIE), 4);
    const e = signed(ev("checkout.session.completed", session, "evt_route_paid"));
    const first = await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log });
    assert.equal(first.status, 200);
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "paid");
    const again = await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log });
    assert.equal(((await again.json()) as { duplicate?: boolean }).duplicate, true);
    assert.equal(await stock(HOODIE), 4);
    assert.equal((await store.getReservation(id))?.status, "committed");
    assert.equal((await store.recentOrders()).length, 1);
  });

  test("Redis down while processing: 500 so Stripe retries, and nothing is half-recorded as done", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    const e = signed(ev("checkout.session.completed", session, "evt_down"));
    flaky.down = true;
    const res = await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log });
    assert.equal(res.status, 500);
    assert.doesNotMatch(await res.text(), /ECONNREFUSED|SECRET-TOKEN/);
    flaky.down = false;
    assert.equal(await store.isEventProcessed("evt_down"), false);
  });

  test("a webhook that fails halfway is finished by Stripe's retry: one order, one stock deduction", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { id, session } = await reserved(HOODIE, 2);
    const e = signed(ev("checkout.session.completed", session, "evt_half"));
    // The commit succeeds, then recording the order fails.
    flaky.failOnce = S.ORDER_UPSERT;
    assert.equal((await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log })).status, 500);
    assert.equal((await store.getReservation(id))?.status, "committed", "stock was already finalized");
    assert.equal(await store.getOrder("cs_test_paid"), null, "but the order wasn't written yet");
    assert.equal(await store.isEventProcessed("evt_half"), false, "so the event is not marked done");
    // Stripe retries the same event.
    assert.equal((await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log })).status, 200);
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "paid");
    assert.equal(await stock(HOODIE), 3, "deducted once, not twice");
    assert.equal((await store.recentOrders()).length, 1);
    // And a third delivery is a no-op.
    assert.equal(((await (await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log })).json()) as { duplicate?: boolean }).duplicate, true);
  });

  test("logs are structured and carry no customer data", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    logs.length = 0;
    const e = signed(ev("checkout.session.completed", session));
    await handleWebhookRequest(webhookReq(e.raw, e.headers), { secret: SECRET, store, log });
    assert.ok(logs.some((l) => l.evt === "webhook" && l.outcome === "committed"));
    assert.doesNotMatch(JSON.stringify(logs), /buyer@example\.com|Test Buyer|1 Test Street|78701|pi_test_123/);
  });
});

// ---------------------------------------------------------------- 4. order records
describe("paid orders contain what fulfilment needs", () => {
  test("shipping address, payment reference, items, amounts and an unfulfilled status are recorded", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { id, session } = await reserved(HOODIE, 2);
    await handleStripeEvent(ev("checkout.session.completed", { ...session, amount_total: 25000, amount_subtotal: 25000 }), store, { log });
    const o = (await store.getOrder("cs_test_paid"))!;
    assert.equal(o.status, "paid");
    assert.equal(o.fulfillment, "unfulfilled");
    assert.equal(o.details.reservationId, id);
    assert.equal(o.details.paymentIntent, "pi_test_123");
    assert.equal(o.details.email, "buyer@example.com");
    assert.equal(o.details.customerName, "Test Buyer");
    assert.equal(o.details.amountTotal, 25000);
    assert.equal(o.details.currency, "usd");
    assert.deepEqual(o.details.shipping?.address, { line1: "1 Test Street", city: "Austin", state: "TX", postal_code: "78701", country: "US" });
    assert.deepEqual(o.details.items, [{ sku: HOODIE, name: "Signature Heavyweight Hoodie", variant: "washed black / M", qty: 2, catalogUnitCents: 12500 }]);
    assert.equal(o.details.note, undefined);
    assert.ok(o.createdAt > 0 && o.updatedAt > 0);
  });

  test("older API versions (shipping_details) and an expanded payment_intent object are both understood", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    const legacy: CheckoutSession = { ...session, collected_information: undefined, shipping_details: { name: "Old Style", address: { city: "Dallas", country: "US" } }, payment_intent: { id: "pi_expanded" } };
    await handleStripeEvent(ev("checkout.session.completed", legacy), store, { log });
    const o = (await store.getOrder("cs_test_paid"))!;
    assert.equal(o.details.shipping?.name, "Old Style");
    assert.equal(o.details.paymentIntent, "pi_expanded");
  });

  test("a charged subtotal that differs from what was reserved is held for review (needs_attention), with the stock kept", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    await handleStripeEvent(ev("checkout.session.completed", { ...session, amount_subtotal: 9999 }), store, { log });
    const o = (await store.getOrder("cs_test_paid"))!;
    assert.equal(o.status, "needs_attention");
    assert.match(o.details.note ?? "", /Stripe charged a subtotal of 9999 but 12500 was reserved/);
    assert.equal(o.fulfillment, "unfulfilled", "it can still be shipped once a person has checked it");
    assert.equal(await stock(HOODIE), 4);
  });

  test("an unpaid (delayed-method) session is not marked paid and cannot be fulfilled", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    await handleStripeEvent(ev("checkout.session.completed", { ...session, payment_status: "unpaid" }), store, { log });
    const o = (await store.getOrder("cs_test_paid"))!;
    assert.equal(o.status, "awaiting_payment");
    assert.equal(o.fulfillment, undefined);
    assert.equal(await store.setFulfilment("cs_test_paid", "shipped", Date.now()), "not_fulfillable");
  });

  test("fulfilment moves unfulfilled -> shipped | cancelled once, and later events never reset it", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    await handleStripeEvent(ev("checkout.session.completed", session), store, { log });
    assert.equal(await store.setFulfilment("cs_test_paid", "shipped", 1000, "1Z999"), "ok");
    assert.equal(await store.setFulfilment("cs_test_paid", "shipped", 2000), "unchanged");
    assert.equal(await store.setFulfilment("cs_test_paid", "cancelled", 3000), "invalid_transition:shipped");
    // A replay of the paid event (different event id) must not reset a shipped order.
    await handleStripeEvent(ev("checkout.session.async_payment_succeeded", session), store, { log });
    const o = (await store.getOrder("cs_test_paid"))!;
    assert.equal(o.fulfillment, "shipped");
    assert.equal(o.tracking, "1Z999");
    assert.equal(o.fulfillmentUpdatedAt, 1000);
  });
});

// ---------------------------------------------------------------- 5. status ordering
describe("order status only moves forward", () => {
  test("a failed-payment event arriving after payment cannot overwrite a paid order", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { id, session } = await reserved();
    await handleStripeEvent(ev("checkout.session.completed", session), store, { log });
    await handleStripeEvent(ev("checkout.session.async_payment_failed", session), store, { log });
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "paid");
    assert.equal((await store.getReservation(id))?.status, "committed");
    assert.equal(await stock(HOODIE), 4);
  });

  test("a payment that succeeds after an earlier failure record upgrades the order to paid", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    await handleStripeEvent(ev("checkout.session.async_payment_failed", session), store, { log });
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "payment_failed");
    assert.equal(await stock(HOODIE), 5);
    await handleStripeEvent(ev("checkout.session.async_payment_succeeded", session), store, { log });
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "paid");
    assert.equal(await stock(HOODIE), 4, "stock re-taken for the paid order, not oversold");
  });

  test("an oversold order stays flagged even if the paid event is delivered again", async () => {
    await store.setStock({ [HOODIE]: 1 });
    const a = await reserved(HOODIE, 1, "cs_test_late");
    await store.release(a.id, "expired_sweep");
    const b = uuid();
    assert.deepEqual(await store.reserve(b, [{ sku: HOODIE, qty: 1 }], FUTURE()), { ok: true }); // someone else buys the last one
    await handleStripeEvent(ev("checkout.session.completed", a.session), store, { log });
    await handleStripeEvent(ev("checkout.session.async_payment_succeeded", a.session), store, { log });
    assert.equal((await store.getOrder("cs_test_late"))?.status, "needs_attention");
    assert.equal(await stock(HOODIE), 0);
  });
});

describe("refunds and the status ladder together", () => {
  const fakeRefunds = () => {
    const calls: { pi: string; idem: string }[] = [];
    return { calls, api: { async createRefund(pi: string, idem: string) { calls.push({ pi, idem }); return { id: `re_${calls.length}` }; } } };
  };

  test("a refunded order stays refunded when a later paid event is replayed; any repeat refund reuses the same idempotency key", async () => {
    await store.setStock({ [HOODIE]: 1 });
    const a = await reserved(HOODIE, 1, "cs_test_late");
    await store.release(a.id, "expired_sweep");
    assert.deepEqual(await store.reserve(uuid(), [{ sku: HOODIE, qty: 1 }], FUTURE()), { ok: true }); // the last unit is resold
    const r = fakeRefunds();
    const first = await handleStripeEvent(ev("checkout.session.completed", a.session), store, { log, refunds: r.api });
    assert.equal(first.outcome, "refunded_out_of_stock");
    assert.equal((await store.getOrder("cs_test_late"))?.status, "refunded");
    await handleStripeEvent(ev("checkout.session.async_payment_succeeded", a.session), store, { log, refunds: r.api });
    assert.equal((await store.getOrder("cs_test_late"))?.status, "refunded", "refunded is final");
    assert.ok(r.calls.every((c) => c.idem === `refund_${a.id}` && c.pi === "pi_test_123"), "Stripe dedupes repeats by this key");
    assert.equal(await stock(HOODIE), 0, "never oversold");
    assert.equal(await store.setFulfilment("cs_test_late", "shipped", Date.now()), "not_fulfillable");
  });

  test("reconcile --apply on a lost payment whose stock was resold refunds the customer, exactly like the webhook would", async () => {
    await store.setStock({ [HOODIE]: 1 });
    const a = await reserved(HOODIE, 1, "cs_test_lost");
    await store.release(a.id, "expired_sweep");
    assert.deepEqual(await store.reserve(uuid(), [{ sku: HOODIE, qty: 1 }], FUTURE()), { ok: true });
    const r = fakeRefunds();
    const report = await reconcile(store, [a.session], { apply: true, log, refunds: r.api });
    assert.deepEqual(report.repaired, ["cs_test_lost"]);
    assert.equal((await store.getOrder("cs_test_lost"))?.status, "refunded");
    assert.equal(r.calls.length, 1);
  });
});

// ---------------------------------------------------------------- 6. reconciliation with Stripe
describe("reconciliation with Stripe", () => {
  test("a paid session whose webhook never arrived is found, then rebuilt safely (twice is harmless)", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { id, session } = await reserved(HOODIE, 2);
    const dry = await reconcile(store, [session], { apply: false, log });
    assert.deepEqual(dry.missing, ["cs_test_paid"]);
    assert.equal(await store.getOrder("cs_test_paid"), null, "a dry run changes nothing");
    const fixed = await reconcile(store, [session], { apply: true, log });
    assert.deepEqual(fixed.repaired, ["cs_test_paid"]);
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "paid");
    assert.equal((await store.getReservation(id))?.status, "committed");
    assert.equal(await stock(HOODIE), 3);
    const again = await reconcile(store, [session], { apply: true, log });
    assert.equal(again.ok, 1);
    assert.equal(again.missing.length + again.mismatched.length, 0);
    assert.equal(await stock(HOODIE), 3);
    assert.equal((await store.recentOrders()).length, 1);
  });

  test("Stripe says paid but Redis says payment_failed: reported and repaired", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    await handleStripeEvent(ev("checkout.session.async_payment_failed", session), store, { log });
    const r = await reconcile(store, [session], { apply: true, log });
    assert.equal(r.mismatched.length, 1);
    assert.deepEqual(r.repaired, ["cs_test_paid"]);
    assert.equal((await store.getOrder("cs_test_paid"))?.status, "paid");
  });

  test("an amount difference is reported but never auto-changed; sessions from elsewhere are skipped", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const { session } = await reserved();
    await handleStripeEvent(ev("checkout.session.completed", session), store, { log });
    const r = await reconcile(store, [{ ...session, amount_total: 99999 }, { id: "cs_other", status: "complete", payment_status: "paid" }], { apply: true, log });
    assert.equal(r.skipped, 1);
    assert.equal(r.mismatched.length, 1);
    assert.match(r.mismatched[0].problem, /amount differs/);
    assert.equal(r.repaired.length, 0);
    assert.equal((await store.getOrder("cs_test_paid"))?.details.amountTotal, 12500);
  });

  test("listing Stripe sessions pages through results and never echoes the key on errors", async () => {
    const seen: string[] = [];
    const pages = [
      { data: [{ id: "cs_1" }, { id: "cs_2" }], has_more: true },
      { data: [{ id: "cs_3" }], has_more: false },
    ];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push(String(url));
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer sk_test_abc");
      return Response.json(pages.shift()!);
    }) as typeof fetch;
    const out = await listCompletedSessions("sk_test_abc", 1000, fakeFetch);
    assert.deepEqual(out.map((s) => s.id), ["cs_1", "cs_2", "cs_3"]);
    assert.match(seen[0], /status=complete/);
    assert.match(seen[0], /created%5Bgte%5D=1000/);
    assert.match(seen[1], /starting_after=cs_2/);
    const failing = (async () => Response.json({ error: { message: "Invalid API Key provided" } }, { status: 401 })) as typeof fetch;
    await assert.rejects(listCompletedSessions("sk_test_abc", 1000, failing), (e: Error) => !e.message.includes("sk_test_abc") && /Invalid API Key/.test(e.message));
  });
});
