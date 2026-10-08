import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCheckout } from "@/lib/checkout/create";
import { processWebhook } from "@/lib/checkout/webhook";
import { HOODIE, WEBHOOK_SECRET, eventBody, fakeStripe, makeStore, sessionObject } from "./helpers";

const ctx = makeStore();
const { store, stock, setStock } = ctx;
afterAll(() => ctx.close());

let client = 0;
/** Starts a real checkout (reserving stock) and returns the ids Stripe would later put in its events. */
async function startCheckout(s: ReturnType<typeof fakeStripe>, qty = 1) {
  const r = await createCheckout({ items: [{ ...HOODIE, qty }], clientId: `c${++client}` }, { store, stripe: s.stripe, siteUrl: "https://lsw.test" });
  expect(r.status).toBe(200);
  const reservationId = s.create.mock.calls.at(-1)![0].metadata!.reservationId as string;
  return { reservationId, sessionId: `cs_test_${s.create.mock.calls.length}` };
}
const deliver = (s: ReturnType<typeof fakeStripe>, type: string, obj: unknown, id?: string, opts: { secret?: string | undefined; signWith?: string } = {}) => {
  const raw = eventBody(type, obj, id);
  return processWebhook({ raw, signature: s.sign(raw, opts.signWith ?? WEBHOOK_SECRET), secret: "secret" in opts ? opts.secret : WEBHOOK_SECRET, store, stripe: s.stripe });
};
const orders = async (reservationId: string) => (await store.listOrders(100)).filter((o) => o.id === reservationId);

describe("signature verification", () => {
  const s = fakeStripe();
  const raw = eventBody("checkout.session.completed", sessionObject({ id: "cs_x", reservationId: "res_x" }), "evt_sig");

  it("rejects a missing signature", async () => {
    expect((await processWebhook({ raw, signature: null, secret: WEBHOOK_SECRET, store, stripe: s.stripe })).status).toBe(400);
  });
  it("rejects a signature made with the wrong secret", async () => {
    expect((await processWebhook({ raw, signature: s.sign(raw, "whsec_attacker"), secret: WEBHOOK_SECRET, store, stripe: s.stripe })).status).toBe(400);
  });
  it("rejects a body that was changed after signing", async () => {
    const tampered = raw.replace("cs_x", "cs_y");
    expect((await processWebhook({ raw: tampered, signature: s.sign(raw), secret: WEBHOOK_SECRET, store, stripe: s.stripe })).status).toBe(400);
  });
  it("fails closed when the webhook secret isn't configured", async () => {
    expect((await processWebhook({ raw, signature: s.sign(raw), secret: undefined, store, stripe: s.stripe })).status).toBe(500);
  });
  it("does not record or claim an event whose signature failed", async () => {
    await processWebhook({ raw, signature: s.sign(raw, "whsec_attacker"), secret: WEBHOOK_SECRET, store, stripe: s.stripe });
    expect(await store.claimEvent("evt_sig")).toBe("claimed");
  });
});

describe("successful payment", () => {
  beforeEach(() => setStock(HOODIE, 5));

  it("creates one order with the shipping details, and keeps the stock deducted", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s, 2);
    const r = await deliver(s, "checkout.session.completed", sessionObject({ id: sessionId, reservationId, subtotal: 24000 }));
    expect(r).toMatchObject({ status: 200, body: { outcome: "order_created" } });
    const [order] = await orders(reservationId);
    expect(order).toMatchObject({ status: "paid", email: "buyer@example.com", amountSubtotal: 24000, paymentIntent: "pi_test_123" });
    expect(order.items).toEqual([expect.objectContaining({ slug: HOODIE.slug, size: "M", qty: 2, unitAmount: 12000 })]);
    expect(await stock(HOODIE)).toBe(3);
  });

  it("flags an order for review if Stripe charged a different amount than we reserved", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    await deliver(s, "checkout.session.completed", sessionObject({ id: sessionId, reservationId, subtotal: 100 }));
    expect((await orders(reservationId))[0]).toMatchObject({ status: "needs_review" });
  });
});

describe("duplicate webhooks", () => {
  beforeEach(() => setStock(HOODIE, 5));

  it("the same event delivered 10 times at once makes one order and deducts stock once", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s, 2);
    const raw = eventBody("checkout.session.completed", sessionObject({ id: sessionId, reservationId, subtotal: 24000 }), "evt_dup_same");
    const sig = s.sign(raw);
    const results = await Promise.all(Array.from({ length: 10 }, () => processWebhook({ raw, signature: sig, secret: WEBHOOK_SECRET, store, stripe: s.stripe })));
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true); // 409 = told to retry while another copy runs
    expect(await orders(reservationId)).toHaveLength(1);
    expect(await stock(HOODIE)).toBe(3);
    // a later redelivery is acknowledged and ignored
    expect(await processWebhook({ raw, signature: sig, secret: WEBHOOK_SECRET, store, stripe: s.stripe })).toMatchObject({ status: 200, body: { duplicate: true } });
    expect(await orders(reservationId)).toHaveLength(1);
  });

  it("two different events for the same payment (completed, then async succeeded) still make one order", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    const obj = sessionObject({ id: sessionId, reservationId });
    await deliver(s, "checkout.session.completed", obj);
    const second = await deliver(s, "checkout.session.async_payment_succeeded", obj);
    expect(second.body.outcome).toBe("duplicate_ignored");
    expect(await orders(reservationId)).toHaveLength(1);
    expect(await stock(HOODIE)).toBe(4);
  });

  it("a stale 'expired' event arriving after payment does not give the stock back", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    const obj = sessionObject({ id: sessionId, reservationId });
    await deliver(s, "checkout.session.completed", obj);
    const r = await deliver(s, "checkout.session.expired", obj);
    expect(r.body.outcome).toBe("release_paid");
    expect(await stock(HOODIE)).toBe(4);
  });

  it("two 'expired' events release the stock once", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s, 2);
    const obj = sessionObject({ id: sessionId, reservationId });
    await deliver(s, "checkout.session.expired", obj);
    await deliver(s, "checkout.session.expired", obj);
    expect(await stock(HOODIE)).toBe(5);
  });
});

describe("failed, expired and delayed payments", () => {
  beforeEach(() => setStock(HOODIE, 5));

  it("a declined card keeps the hold (the customer can try another card), and the later expiry releases it", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    const failed = await deliver(s, "payment_intent.payment_failed", { id: "pi_x", metadata: { reservationId } });
    expect(failed.body.outcome).toBe("payment_failed_hold_kept");
    expect(await stock(HOODIE)).toBe(4);
    expect(await orders(reservationId)).toHaveLength(0);
    await deliver(s, "checkout.session.expired", sessionObject({ id: sessionId, reservationId }));
    expect(await stock(HOODIE)).toBe(5);
    expect(await orders(reservationId)).toHaveLength(0);
  });

  it("an expired session releases the stock and creates no order", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s, 2);
    const r = await deliver(s, "checkout.session.expired", sessionObject({ id: sessionId, reservationId }));
    expect(r.body.outcome).toBe("release_released_now");
    expect(await stock(HOODIE)).toBe(5);
    expect(await orders(reservationId)).toHaveLength(0);
  });

  it("a delayed payment method waits for confirmation: no order while unpaid, order once it succeeds", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    const unpaid = sessionObject({ id: sessionId, reservationId, paid: false });
    expect((await deliver(s, "checkout.session.completed", unpaid)).body.outcome).toBe("awaiting_async_payment");
    expect(await orders(reservationId)).toHaveLength(0);
    expect(await stock(HOODIE)).toBe(4);
    await deliver(s, "checkout.session.async_payment_succeeded", sessionObject({ id: sessionId, reservationId }));
    expect(await orders(reservationId)).toHaveLength(1);
  });

  it("a delayed payment that fails releases the stock and creates no order", async () => {
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    await deliver(s, "checkout.session.completed", sessionObject({ id: sessionId, reservationId, paid: false }));
    await deliver(s, "checkout.session.async_payment_failed", sessionObject({ id: sessionId, reservationId, paid: false }));
    expect(await stock(HOODIE)).toBe(5);
    expect(await orders(reservationId)).toHaveLength(0);
  });
});

describe("payment that arrives after the hold was released", () => {
  it("re-takes the stock and keeps the order when the unit is still available", async () => {
    await setStock(HOODIE, 1);
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    await store.release(reservationId, "swept");
    const r = await deliver(s, "checkout.session.completed", sessionObject({ id: sessionId, reservationId }));
    expect(r.body.outcome).toBe("order_created_late");
    expect(await stock(HOODIE)).toBe(0);
    expect(s.refund).not.toHaveBeenCalled();
  });

  it("refunds the customer, once, when someone else already bought the unit; stock never goes negative", async () => {
    await setStock(HOODIE, 1);
    const s = fakeStripe();
    const { reservationId, sessionId } = await startCheckout(s);
    await store.release(reservationId, "swept");
    await startCheckout(s); // another customer takes the unit
    expect(await stock(HOODIE)).toBe(0);
    const obj = sessionObject({ id: sessionId, reservationId });
    const r = await deliver(s, "checkout.session.completed", obj);
    expect(r.body.outcome).toBe("refunded_out_of_stock");
    expect(s.refund).toHaveBeenCalledTimes(1);
    expect(s.refund.mock.calls[0][0]).toMatchObject({ payment_intent: "pi_test_123" });
    expect(await stock(HOODIE)).toBe(0);
    expect((await orders(reservationId))[0]).toMatchObject({ status: "refund_pending" });
    // a redelivery (new event id) does not refund again
    const again = await deliver(s, "checkout.session.async_payment_succeeded", obj);
    expect(again.body.outcome).toBe("refund_already_pending");
    expect(s.refund).toHaveBeenCalledTimes(1);
  });
});

describe("unexpected input", () => {
  it("a paid session we have no record of fails (so Stripe retries and the owner notices) and can be retried", async () => {
    const s = fakeStripe();
    const obj = sessionObject({ id: "cs_orphan", reservationId: "res_missing" });
    const raw = eventBody("checkout.session.completed", obj, "evt_orphan");
    const first = await processWebhook({ raw, signature: s.sign(raw), secret: WEBHOOK_SECRET, store, stripe: s.stripe });
    expect(first.status).toBe(500);
    const second = await processWebhook({ raw, signature: s.sign(raw), secret: WEBHOOK_SECRET, store, stripe: s.stripe });
    expect(second.status).toBe(500); // retried, not swallowed as "done"
  });

  it("a session that isn't ours (no reservation id) is ignored", async () => {
    const s = fakeStripe();
    const r = await deliver(s, "checkout.session.completed", { id: "cs_foreign", object: "checkout.session", payment_status: "paid", metadata: {} });
    expect(r).toMatchObject({ status: 200, body: { outcome: "ignored_not_ours" } });
  });

  it("event types we don't handle are acknowledged", async () => {
    const s = fakeStripe();
    expect((await deliver(s, "customer.created", { id: "cus_1" })).body.outcome).toBe("ignored_event_type");
  });
});
