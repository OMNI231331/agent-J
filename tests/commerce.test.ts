import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { findSku, products } from "../lib/catalog.ts";
import { cancelCheckout, startCheckout, SESSION_TTL_MS } from "../lib/commerce/checkout.ts";
import { InventoryStore, K } from "../lib/commerce/store.ts";
import { signStripePayload, verifyStripeSignature, type CheckoutSession, type StripeApi } from "../lib/commerce/stripe.ts";
import { validateCart } from "../lib/commerce/validate.ts";
import { commerceConfig } from "../lib/commerce/config.ts";
import { clientIp } from "../lib/commerce/client-ip.ts";
import { handleStripeEvent, type StripeEvent } from "../lib/commerce/webhook.ts";
import { RespClient, startRedis } from "./redis-harness.ts";

const HOODIE = "LSW001-HOOD-WASHED-BLACK-M";
const HOODIE_L = "LSW001-HOOD-WASHED-BLACK-L";
const TEE = "LSW001-TEE-WASHED-BLACK-M";
const CONCEPT = "LSW001-STMT-BLACK-M";

let redis: Awaited<ReturnType<typeof startRedis>>;
let client: RespClient;
let store: InventoryStore;
const clients: RespClient[] = [];

before(async () => {
  redis = await startRedis();
  client = new RespClient(redis.port);
  await client.ready();
  store = new InventoryStore(client);
});
after(() => {
  client.close();
  clients.forEach((c) => c.close());
  redis.stop();
});
beforeEach(async () => {
  await client.command("FLUSHALL");
});

const stock = async (sku: string) => (await store.getStock([sku]))[sku];
let seq = 0;
const rid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const FUTURE = () => Date.now() + 60 * 60 * 1000;

function event(type: string, session: Partial<CheckoutSession>, id = `evt_${++seq}`): StripeEvent {
  return { id, type, data: { object: { id: "cs_test_1", amount_total: 12500, currency: "usd", customer_details: { email: "buyer@example.com" }, ...session } as CheckoutSession } };
}

// ---------------------------------------------------------------- stock limits
describe("reservations and stock limits", () => {
  test("reserving within stock decrements it", async () => {
    await store.setStock({ [HOODIE]: 5 });
    assert.deepEqual(await store.reserve(rid(), [{ sku: HOODIE, qty: 2 }], FUTURE()), { ok: true });
    assert.equal(await stock(HOODIE), 3);
  });

  test("cannot reserve more than is in stock, and nothing changes", async () => {
    await store.setStock({ [HOODIE]: 1 });
    const r = await store.reserve(rid(), [{ sku: HOODIE, qty: 2 }], FUTURE());
    assert.deepEqual(r, { ok: false, reason: "insufficient", sku: HOODIE, available: 1 });
    assert.equal(await stock(HOODIE), 1);
  });

  test("multi-item orders are all-or-nothing", async () => {
    await store.setStock({ [HOODIE]: 5, [TEE]: 0 });
    const r = await store.reserve(rid(), [{ sku: HOODIE, qty: 1 }, { sku: TEE, qty: 1 }], FUTURE());
    assert.equal(r.ok, false);
    assert.equal(await stock(HOODIE), 5, "hoodie must not be decremented when the tee fails");
  });

  test("a SKU that was never stocked cannot be reserved", async () => {
    const r = await store.reserve(rid(), [{ sku: HOODIE, qty: 1 }], FUTURE());
    assert.deepEqual(r, { ok: false, reason: "insufficient", sku: HOODIE, available: null });
    assert.equal(await stock(HOODIE), null);
  });

  test("the same reservation id cannot be reserved twice", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const id = rid();
    await store.reserve(id, [{ sku: HOODIE, qty: 1 }], FUTURE());
    assert.deepEqual(await store.reserve(id, [{ sku: HOODIE, qty: 1 }], FUTURE()), { ok: false, reason: "duplicate" });
    assert.equal(await stock(HOODIE), 4);
  });

  test("release is idempotent and returns stock exactly once", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const id = rid();
    await store.reserve(id, [{ sku: HOODIE, qty: 2 }], FUTURE());
    assert.equal(await store.release(id, "test"), "released");
    assert.equal(await store.release(id, "test"), "noop:released");
    assert.equal(await stock(HOODIE), 3);
  });

  test("a committed reservation can never be released", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const id = rid();
    await store.reserve(id, [{ sku: HOODIE, qty: 1 }], FUTURE());
    assert.equal(await store.commit(id), "committed");
    assert.equal(await store.release(id, "late-expiry"), "noop:committed");
    assert.equal(await stock(HOODIE), 2);
  });
});

test("restock adds relative to live stock and can't go below zero", async () => {
  await store.setStock({ [HOODIE]: 2 });
  await store.reserve(rid(), [{ sku: HOODIE, qty: 1 }], FUTURE());
  assert.equal(await store.adjustStock(HOODIE, 10), 11, "restock keeps the units held by open reservations");
  assert.equal(await store.adjustStock(HOODIE, -50), null);
  assert.equal(await stock(HOODIE), 11);
});

test("rate limiter allows the limit, blocks the excess, and is per bucket", async () => {
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await store.allow("checkout:1.2.3.4", 3, 60));
  assert.deepEqual(results, [true, true, true, false, false]);
  assert.equal(await store.allow("checkout:5.6.7.8", 3, 60), true);
  assert.ok(Number(await client.command("TTL", K.rate("checkout:1.2.3.4"))) > 0, "window must expire");
});

// ---------------------------------------------------------------- concurrency
describe("concurrent purchases", () => {
  async function pool(n: number) {
    while (clients.length < n) {
      const c = new RespClient(redis.port);
      await c.ready();
      clients.push(c);
    }
    return clients.slice(0, n).map((c) => new InventoryStore(c));
  }

  test("40 simultaneous buyers for 3 units: exactly 3 succeed, stock never goes negative", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const stores = await pool(8);
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => stores[i % 8].reserve(rid(), [{ sku: HOODIE, qty: 1 }], FUTURE())));
    assert.equal(results.filter((r) => r.ok).length, 3);
    assert.equal(await stock(HOODIE), 0);
  });

  test("mixed quantities: 20 buyers of 2 units against 5 in stock → 2 succeed, 1 left", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const stores = await pool(8);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => stores[i % 8].reserve(rid(), [{ sku: HOODIE, qty: 2 }], FUTURE())));
    assert.equal(results.filter((r) => r.ok).length, 2);
    assert.equal(await stock(HOODIE), 1);
  });

  test("concurrent multi-item carts never oversell either item", async () => {
    await store.setStock({ [HOODIE]: 4, [TEE]: 2 });
    const stores = await pool(8);
    const carts = Array.from({ length: 30 }, (_, i) => (i % 2 ? [{ sku: HOODIE, qty: 1 }, { sku: TEE, qty: 1 }] : [{ sku: HOODIE, qty: 1 }]));
    await Promise.all(carts.map((c, i) => stores[i % 8].reserve(rid(), c, FUTURE())));
    const s = await store.getStock([HOODIE, TEE]);
    assert.ok(s[HOODIE]! >= 0 && s[TEE]! >= 0);
    assert.equal(s[HOODIE], 0, "all 4 hoodies sell");
  });
});

// ---------------------------------------------------------------- webhooks
describe("webhook processing", () => {
  async function reserved(qty = 1, start = 5) {
    await store.setStock({ [HOODIE]: start });
    const id = rid();
    await store.reserve(id, [{ sku: HOODIE, qty }], FUTURE());
    await store.attachSession(id, "cs_test_1", findSku(HOODIE)!.product.priceCents * qty);
    return id;
  }

  test("a paid checkout creates one order and keeps the stock deducted", async () => {
    const id = await reserved(2);
    const r = await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }), store);
    assert.equal(r.outcome, "committed");
    const order = await store.getOrder("cs_test_1");
    assert.equal(order?.status, "paid");
    assert.deepEqual(order?.details.lines, [{ sku: HOODIE, qty: 2 }]);
    assert.equal(await stock(HOODIE), 3);
  });

  test("the same event delivered twice is processed once", async () => {
    const id = await reserved();
    const e = event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }, "evt_dup");
    await handleStripeEvent(e, store);
    const second = await handleStripeEvent(e, store);
    assert.equal(second.duplicate, true);
    assert.equal(await stock(HOODIE), 4);
    assert.equal(Number(await client.command("ZCARD", K.orderIndex)), 1);
  });

  test("duplicate deliveries racing in parallel still deduct stock once", async () => {
    const id = await reserved();
    const e = event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }, "evt_race");
    const c2 = new RespClient(redis.port);
    await c2.ready();
    await Promise.all([handleStripeEvent(e, store), handleStripeEvent(e, new InventoryStore(c2)), handleStripeEvent({ ...e, id: "evt_race_retry" }, store)]);
    c2.close();
    assert.equal(await stock(HOODIE), 4);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "paid");
  });

  test("an expired session returns the stock", async () => {
    const id = await reserved(2);
    const r = await handleStripeEvent(event("checkout.session.expired", { metadata: { reservation_id: id } }), store);
    assert.equal(r.outcome, "released");
    assert.equal(await stock(HOODIE), 5);
    assert.equal(await store.getOrder("cs_test_1"), null);
  });

  test("a failed async payment returns the stock and records the failure", async () => {
    const id = await reserved();
    await handleStripeEvent(event("checkout.session.completed", { payment_status: "unpaid", metadata: { reservation_id: id } }), store);
    assert.equal((await store.getReservation(id))?.status, "awaiting_payment");
    assert.equal(await stock(HOODIE), 4, "stock stays held while payment is pending");
    await handleStripeEvent(event("checkout.session.async_payment_failed", { metadata: { reservation_id: id } }), store);
    assert.equal(await stock(HOODIE), 5);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "payment_failed");
  });

  test("a successful async payment commits the order", async () => {
    const id = await reserved();
    await handleStripeEvent(event("checkout.session.completed", { payment_status: "unpaid", metadata: { reservation_id: id } }), store);
    await handleStripeEvent(event("checkout.session.async_payment_succeeded", { metadata: { reservation_id: id } }), store);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "paid");
    assert.equal(await stock(HOODIE), 4);
  });

  test("out-of-order events never move a paid order backwards", async () => {
    const id = await reserved();
    await handleStripeEvent(event("checkout.session.async_payment_succeeded", { metadata: { reservation_id: id } }), store);
    await handleStripeEvent(event("checkout.session.completed", { payment_status: "unpaid", metadata: { reservation_id: id } }), store);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "paid");
    assert.equal(await stock(HOODIE), 4);
  });

  test("payment completing after release re-takes stock when it's still there", async () => {
    const id = await reserved(1, 5);
    await store.release(id, "test-expired");
    const r = await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }), store);
    assert.equal(r.outcome, "recommitted");
    assert.equal(await stock(HOODIE), 4);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "paid");
  });

  test("payment completing after the stock was resold is flagged, never oversold", async () => {
    const id = await reserved(1, 1);
    await store.release(id, "test-expired");
    await store.reserve(rid(), [{ sku: HOODIE, qty: 1 }], FUTURE()); // someone else buys the last one
    const r = await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }), store);
    assert.equal(r.outcome, "oversold_manual_refund", "without a Stripe client the order is flagged for a manual refund");
    assert.equal(await stock(HOODIE), 0, "stock must not go negative");
    const order = await store.getOrder("cs_test_1");
    assert.equal(order?.status, "needs_attention");
    assert.match(order!.details.note!, /Refund this customer manually/);
  });

  describe("automatic refund when a late payment can't be fulfilled", () => {
    const price = findSku(HOODIE)!.product.priceCents;
    function refunds(failFirst = 0) {
      const calls: { pi: string; key: string; reservationId: string; ok: boolean }[] = [];
      let toFail = failFirst;
      return {
        calls,
        api: {
          async createRefund(pi: string, key: string, reservationId: string) {
            const ok = toFail-- <= 0;
            calls.push({ pi, key, reservationId, ok });
            if (!ok) throw new Error("Stripe API timeout");
            return { id: "re_test_1" };
          },
        },
      };
    }
    async function soldOutLatePayment() {
      const id = await reserved(1, 1);
      await store.release(id, "test-expired");
      await store.reserve(rid(), [{ sku: HOODIE, qty: 1 }], FUTURE()); // someone else buys the last one
      return id;
    }
    const paidEvent = (id: string, evtId: string) => event("checkout.session.completed", { payment_status: "paid", payment_intent: "pi_test_1", amount_subtotal: price, metadata: { reservation_id: id } }, evtId);

    test("refunds the customer in full, once, and records the order as refunded", async () => {
      const id = await soldOutLatePayment();
      const r = refunds();
      const out = await handleStripeEvent(paidEvent(id, "evt_a"), store, { refunds: r.api });
      assert.equal(out.outcome, "refunded_out_of_stock");
      assert.deepEqual(r.calls, [{ pi: "pi_test_1", key: `refund_${id}`, reservationId: id, ok: true }]);
      assert.equal((await store.getOrder("cs_test_1"))?.status, "refunded");
      assert.equal(await stock(HOODIE), 0);
    });

    test("if the refund call FAILS, Stripe's retry refunds the customer (the order is never stuck charged-but-unrefunded)", async () => {
      const id = await soldOutLatePayment();
      const r = refunds(1);
      const e = paidEvent(id, "evt_b");
      await assert.rejects(handleStripeEvent(e, store, { refunds: r.api }), /timeout/); // route would answer 500
      assert.equal((await store.getOrder("cs_test_1"))?.status, "needs_attention");
      assert.equal(await store.isEventProcessed("evt_b"), false, "failed event must not be marked processed");
      const retry = await handleStripeEvent(e, store, { refunds: r.api }); // Stripe redelivers the same event
      assert.equal(retry.outcome, "refunded_out_of_stock");
      assert.deepEqual(r.calls.map((c) => c.ok), [false, true]);
      assert.equal((await store.getOrder("cs_test_1"))?.status, "refunded");
      assert.equal(new Set(r.calls.map((c) => c.key)).size, 1, "same idempotency key on every attempt, so Stripe can never refund twice");
    });

    test("a later duplicate event never refunds again", async () => {
      const id = await soldOutLatePayment();
      const r = refunds();
      await handleStripeEvent(paidEvent(id, "evt_c"), store, { refunds: r.api });
      await handleStripeEvent(paidEvent(id, "evt_c"), store, { refunds: r.api }); // same event id
      assert.equal(r.calls.length, 1);
    });

    test("without a payment intent the order is flagged for manual refund, nothing is guessed", async () => {
      const id = await soldOutLatePayment();
      const r = refunds();
      const e = event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }, "evt_d");
      assert.equal((await handleStripeEvent(e, store, { refunds: r.api })).outcome, "oversold_manual_refund");
      assert.equal(r.calls.length, 0);
    });
  });

  test("an amount charged that differs from the reserved subtotal is flagged for review (stock still committed)", async () => {
    const id = await reserved(1, 5);
    const e = event("checkout.session.completed", { payment_status: "paid", amount_subtotal: 100, metadata: { reservation_id: id } });
    await handleStripeEvent(e, store);
    const order = await store.getOrder("cs_test_1");
    assert.equal(order?.status, "needs_attention");
    assert.match(order!.details.note!, /charged a subtotal of 100/);
    assert.equal(await stock(HOODIE), 4);
  });

  test("a matching charged amount is a normal paid order", async () => {
    const id = await reserved(2, 5);
    await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", amount_subtotal: findSku(HOODIE)!.product.priceCents * 2, metadata: { reservation_id: id } }), store);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "paid");
  });

  test("unrelated event types are ignored", async () => {
    const r = await handleStripeEvent(event("customer.created", {}), store);
    assert.equal(r.handled, false);
  });
});

// ---------------------------------------------------------------- abandoned reservations
describe("abandoned reservations", () => {
  test("the sweep releases expired holds but not live or awaiting-payment ones", async () => {
    await store.setStock({ [HOODIE]: 10 });
    const old = rid(), live = rid(), awaiting = rid();
    await store.reserve(old, [{ sku: HOODIE, qty: 2 }], Date.now() - 1000);
    await store.reserve(live, [{ sku: HOODIE, qty: 1 }], FUTURE());
    await store.reserve(awaiting, [{ sku: HOODIE, qty: 1 }], Date.now() - 1000);
    await store.markAwaitingPayment(awaiting);
    assert.equal(await store.sweepExpired(Date.now()), 1);
    assert.equal((await store.getReservation(old))?.status, "released");
    assert.equal((await store.getReservation(live))?.status, "reserved");
    assert.equal((await store.getReservation(awaiting))?.status, "awaiting_payment");
    assert.equal(await stock(HOODIE), 8);
    assert.equal(await store.sweepExpired(Date.now()), 0, "a second sweep does nothing");
  });
});

// ---------------------------------------------------------------- signatures
describe("Stripe signature verification", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  test("accepts a valid signature", () => assert.equal(verifyStripeSignature(body, signStripePayload(body, secret), secret), true));
  test("rejects a tampered body", () => assert.equal(verifyStripeSignature(body + " ", signStripePayload(body, secret), secret), false));
  test("rejects the wrong secret", () => assert.equal(verifyStripeSignature(body, signStripePayload(body, "whsec_other"), secret), false));
  test("rejects a replayed (stale) timestamp", () => {
    const old = Math.floor(Date.now() / 1000) - 600;
    assert.equal(verifyStripeSignature(body, signStripePayload(body, secret, old), secret), false);
  });
  test("accepts when one of several v1 signatures matches (secret rotation)", () => {
    const good = signStripePayload(body, secret);
    const t = good.split(",")[0];
    assert.equal(verifyStripeSignature(body, `${t},v1=deadbeef,${good.split(",")[1]}`, secret), true);
  });
  test("rejects a missing or malformed header", () => {
    assert.equal(verifyStripeSignature(body, null, secret), false);
    assert.equal(verifyStripeSignature(body, "garbage", secret), false);
  });
});

// ---------------------------------------------------------------- validation
describe("server-side cart validation", () => {
  const price = findSku(HOODIE)!.product.priceCents;
  test("accepts a valid cart and merges duplicate lines", () => {
    assert.deepEqual(validateCart([{ sku: HOODIE, qty: 1 }, { sku: HOODIE, qty: 1, priceCents: price }], { liveMode: false }), { ok: true, lines: [{ sku: HOODIE, qty: 2 }] });
  });
  const bad: [string, unknown, RegExp][] = [
    ["empty cart", [], /empty/],
    ["unknown SKU", [{ sku: "NOPE", qty: 1 }], /no longer exists/],
    ["zero quantity", [{ sku: HOODIE, qty: 0 }], /Invalid quantity/],
    ["fractional quantity", [{ sku: HOODIE, qty: 1.5 }], /Invalid quantity/],
    ["over the per-item limit across merged lines", [{ sku: HOODIE, qty: 2 }, { sku: HOODIE, qty: 2 }], /Limit 3/],
    ["a stale price from the client", [{ sku: HOODIE, qty: 1, priceCents: 1 }], /price .* has changed/],
    ["a concept product", [{ sku: CONCEPT, qty: 1 }], /not available/],
    ["a mismatched colour", [{ sku: HOODIE, qty: 1, color: "charcoal" }], /Colour/],
    ["a mismatched size", [{ sku: HOODIE, qty: 1, size: "XL" }], /Size/],
    ["a non-array body", { sku: HOODIE }, /empty/],
  ];
  for (const [name, input, re] of bad) test(`rejects ${name}`, () => {
    const r = validateCart(input, { liveMode: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, re);
  });
  test("in live mode, draft-priced products cannot be sold", () => {
    assert.equal(products.find((p) => p.slug === "signature-hoodie")!.pricing, "draft");
    const r = validateCart([{ sku: HOODIE, qty: 1 }], { liveMode: true });
    assert.equal(r.ok, false);
  });
});

// ---------------------------------------------------------------- checkout + cancel
describe("checkout session creation and cancellation", () => {
  function fakeStripe(opts: { fail?: boolean; status?: CheckoutSession["status"] } = {}) {
    const calls: { params?: URLSearchParams; idem?: string; expired: string[] } = { expired: [] };
    let status = opts.status ?? "open";
    const api: StripeApi = {
      async createCheckoutSession(params, idem) {
        calls.params = params;
        calls.idem = idem;
        if (opts.fail) throw new Error("Stripe is down");
        return { id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" };
      },
      async retrieveCheckoutSession(id) {
        return { id, status };
      },
      async expireCheckoutSession(id) {
        calls.expired.push(id);
        status = "expired";
        return { id, status };
      },
    };
    return { api, calls };
  }
  const deps = (stripe: StripeApi) => ({ store, stripe, origin: "https://lsw.test", liveMode: false, newId: rid });

  test("prices come from the catalog and the reservation travels with the session", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const { api, calls } = fakeStripe();
    const before = Date.now();
    const r = await startCheckout([{ sku: HOODIE, qty: 2, priceCents: findSku(HOODIE)!.product.priceCents }], deps(api));
    assert.equal(r.ok, true);
    const p = calls.params!;
    assert.equal(p.get("line_items[0][price_data][unit_amount]"), String(findSku(HOODIE)!.product.priceCents));
    assert.equal(p.get("line_items[0][quantity]"), "2");
    const resId = p.get("metadata[reservation_id]")!;
    assert.equal(calls.idem, resId, "reservation id is the Stripe idempotency key");
    assert.equal(p.get("client_reference_id"), resId);
    assert.ok(Number(p.get("expires_at")) * 1000 >= before + SESSION_TTL_MS - 1000);
    assert.equal((await store.getReservation(resId))?.sessionId, "cs_test_new");
    assert.equal(await stock(HOODIE), 1);
  });

  test("if Stripe fails, the reserved stock is returned immediately", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const r = await startCheckout([{ sku: HOODIE, qty: 1 }], deps(fakeStripe({ fail: true }).api));
    assert.deepEqual(r, { ok: false, status: 502, error: "We couldn't start checkout. Please try again." });
    assert.equal(await stock(HOODIE), 3);
  });

  test("insufficient stock is reported without creating a Stripe session", async () => {
    await store.setStock({ [HOODIE_L]: 0 });
    const { api, calls } = fakeStripe();
    const r = await startCheckout([{ sku: HOODIE_L, qty: 1 }], deps(api));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /sold out/);
    assert.equal(calls.params, undefined);
  });

  test("cancelling an open checkout expires the Stripe session and returns the stock", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const { api, calls } = fakeStripe();
    const r = await startCheckout([{ sku: HOODIE, qty: 1 }], deps(api));
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(await cancelCheckout(r.reservationId, { store, stripe: api }), "released");
    assert.deepEqual(calls.expired, ["cs_test_new"]);
    assert.equal(await stock(HOODIE), 3);
    assert.equal(await cancelCheckout(r.reservationId, { store, stripe: api }), "noop");
  });

  test("a completed (paid) session is never cancelled", async () => {
    await store.setStock({ [HOODIE]: 3 });
    const { api, calls } = fakeStripe({ status: "complete" });
    const r = await startCheckout([{ sku: HOODIE, qty: 1 }], deps(api));
    if (!r.ok) throw new Error("setup");
    assert.equal(await cancelCheckout(r.reservationId, { store, stripe: api }), "noop");
    assert.deepEqual(calls.expired, []);
    assert.equal(await stock(HOODIE), 2);
  });
});

// ---------------------------------------------------------------- added after the multi-agent review
describe("order status can never move backwards", () => {
  test("a late 'payment failed' event cannot overwrite a paid order", async () => {
    await store.setStock({ [HOODIE]: 5 });
    const id = rid();
    await store.reserve(id, [{ sku: HOODIE, qty: 1 }], FUTURE());
    await store.attachSession(id, "cs_test_1", findSku(HOODIE)!.product.priceCents);
    await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", metadata: { reservation_id: id } }), store);
    await handleStripeEvent(event("checkout.session.async_payment_failed", { metadata: { reservation_id: id } }), store);
    assert.equal((await store.getOrder("cs_test_1"))?.status, "paid");
    assert.equal(await stock(HOODIE), 4, "paid stock must stay deducted");
  });
});

describe("order size cap", () => {
  test("rejects more than 6 items in one order, even across different SKUs", () => {
    const r = validateCart([{ sku: HOODIE, qty: 3 }, { sku: HOODIE_L, qty: 3 }, { sku: TEE, qty: 1 }], { liveMode: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /limited to 6/);
  });
  test("accepts exactly 6", () => {
    assert.equal(validateCart([{ sku: HOODIE, qty: 3 }, { sku: HOODIE_L, qty: 3 }], { liveMode: false }).ok, true);
  });
});

describe("live-payment gate (commerceConfig)", () => {
  const msg = (r: ReturnType<typeof commerceConfig>) => (r.ok ? "OK" : r.error);
  test("no key, or a malformed key, means checkout is not connected", () => {
    assert.match(msg(commerceConfig({}, "preview")), /isn't connected/);
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "nonsense" }, "preview")), /isn't connected/);
  });
  test("a test key passes the payment gate (then needs inventory)", () => {
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "sk_test_x" }, "preview")), /Inventory isn't connected/);
  });
  test("a LIVE key is refused unless BOTH ALLOW_LIVE_PAYMENTS=true AND live mode", () => {
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "sk_live_x" }, "live")), /Live payments are not enabled/);
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "sk_live_x", ALLOW_LIVE_PAYMENTS: "true" }, "preview")), /Live payments are not enabled/);
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "sk_live_x", ALLOW_LIVE_PAYMENTS: "false" }, "live")), /Live payments are not enabled/);
    // both gates open: the live gate passes and the next check (inventory) is what's reported
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "sk_live_x", ALLOW_LIVE_PAYMENTS: "true" }, "live")), /Inventory isn't connected/);
  });
  test("restricted live keys are gated the same way", () => {
    assert.match(msg(commerceConfig({ STRIPE_SECRET_KEY: "rk_live_x" }, "preview")), /Live payments are not enabled/);
  });
});

describe("client IP source", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  test("prefers the platform-set headers over a spoofable x-forwarded-for", () => {
    assert.equal(clientIp(h({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "6.6.6.6" })), "1.1.1.1");
    assert.equal(clientIp(h({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "6.6.6.6" })), "2.2.2.2");
  });
  test("falls back to the first x-forwarded-for hop, then 'unknown'", () => {
    assert.equal(clientIp(h({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" })), "3.3.3.3");
    assert.equal(clientIp(h({})), "unknown");
  });
});
