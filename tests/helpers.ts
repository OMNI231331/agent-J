import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import Stripe from "stripe";
import { vi } from "vitest";
import type { StripeLike } from "@/lib/checkout/stripe";
import { InventoryStore } from "@/lib/inventory/store";

export const TEST_REDIS_PORT = 6391;
export const WEBHOOK_SECRET = "whsec_test_secret";

export const HOODIE = { slug: "signature-hoodie", colorId: "charcoal", size: "M" } as const; // $120.00 in lib/lsw.ts
export const TEE = { slug: "oversized-tee", colorId: "washed-black", size: "L" } as const; // $55.00

/** A store on its own key prefix, so tests never see each other's data. */
export function makeStore() {
  const redis = new Redis({ port: TEST_REDIS_PORT, host: "127.0.0.1" });
  const prefix = `t${randomUUID().slice(0, 8)}:`;
  const store = new InventoryStore({ eval: (script, keys, args) => redis.eval(script, keys.length, ...keys, ...args) }, prefix);
  const stock = async (v: { slug: string; colorId: string; size: string }) => (await store.getStock([store.stockKey(v.slug, v.colorId, v.size)]))[0];
  const setStock = (v: { slug: string; colorId: string; size: string }, qty: number) => store.setStock(store.stockKey(v.slug, v.colorId, v.size), qty);
  return { store, redis, prefix, stock, setStock, close: () => redis.quit() };
}

export function fakeStripe(opts: { failCreate?: boolean; failExpire?: boolean } = {}) {
  const real = new Stripe("sk_test_dummy"); // used only for signature maths, never for network calls
  let n = 0;
  const create = vi.fn(async (_params: Stripe.Checkout.SessionCreateParams) => {
    if (opts.failCreate) throw new Error("stripe is down");
    n += 1;
    return { id: `cs_test_${n}`, url: `https://checkout.stripe.test/c/${n}` };
  });
  const expire = vi.fn(async (_id: string) => {
    if (opts.failExpire) throw new Error("session is already complete");
    return {};
  });
  const refund = vi.fn(async (_p: Stripe.RefundCreateParams) => ({}));
  const stripe: StripeLike = {
    checkout: { sessions: { create, expire } },
    refunds: { create: refund },
    webhooks: { constructEvent: (p, h, s) => real.webhooks.constructEvent(p, h, s) },
  };
  return { stripe, create, expire, refund, sign: (payload: string, secret = WEBHOOK_SECRET) => real.webhooks.generateTestHeaderString({ payload, secret }) };
}

let eventCounter = 0;
export function sessionObject(over: { id: string; reservationId: string; paid?: boolean; subtotal?: number }) {
  return {
    id: over.id,
    object: "checkout.session",
    payment_status: over.paid === false ? "unpaid" : "paid",
    client_reference_id: over.reservationId,
    metadata: { reservationId: over.reservationId },
    amount_subtotal: over.subtotal ?? 12000,
    amount_total: over.subtotal ?? 12000,
    currency: "usd",
    payment_intent: "pi_test_123",
    customer_details: { email: "buyer@example.com", name: "Test Buyer" },
    collected_information: { shipping_details: { name: "Test Buyer", address: { line1: "1 Test St", city: "Austin", state: "TX", postal_code: "78701", country: "US" } } },
  };
}

export function eventBody(type: string, object: unknown, id = `evt_test_${++eventCounter}`) {
  return JSON.stringify({ id, object: "event", type, data: { object }, created: Math.floor(Date.now() / 1000) });
}
