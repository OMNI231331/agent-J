import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webhookPOST } from "@/app/api/stripe/webhook/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { GET as cancelGET } from "@/app/api/checkout/cancel/route";
import { GET as availabilityGET } from "@/app/api/availability/[slug]/route";
import { GET as adminGET, POST as adminPOST } from "@/app/api/admin/inventory/route";
import { GET as sweepGET } from "@/app/api/cron/sweep/route";
import { __setStripeForTests } from "@/lib/checkout/stripe";
import { __setStoreForTests } from "@/lib/inventory";
import { HOODIE, WEBHOOK_SECRET, eventBody, fakeStripe, makeStore, sessionObject } from "./helpers";

const ctx = makeStore();
const { store, stock, setStock } = ctx;
const stripe = fakeStripe();
const ADMIN = "a-very-long-random-admin-token-1234567890";

beforeEach(() => {
  __setStoreForTests(store);
  __setStripeForTests(stripe.stripe);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("SITE_URL", "https://lsw.test");
  vi.stubEnv("ADMIN_TOKEN", ADMIN);
  vi.stubEnv("CRON_SECRET", "cron-secret-value");
});
afterEach(() => {
  vi.unstubAllEnvs();
  __setStoreForTests(undefined);
  __setStripeForTests(undefined);
});
afterAll(() => ctx.close());

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://lsw.test${url}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("POST /api/stripe/webhook", () => {
  it("rejects an unsigned request and a forged signature with 400", async () => {
    const raw = eventBody("checkout.session.completed", sessionObject({ id: "cs_1", reservationId: "res_1" }));
    expect((await webhookPOST(post("/api/stripe/webhook", raw))).status).toBe(400);
    expect((await webhookPOST(post("/api/stripe/webhook", raw, { "stripe-signature": stripe.sign(raw, "whsec_wrong") }))).status).toBe(400);
  });

  it("accepts a correctly signed event, and answers 200 on redelivery without a second order", async () => {
    await setStock(HOODIE, 3);
    const checkout = await checkoutPOST(post("/api/checkout", { items: [{ ...HOODIE, qty: 1 }] }, { "x-forwarded-for": "203.0.113.9" }));
    expect(checkout.status).toBe(200);
    const params = stripe.create.mock.calls.at(-1)![0];
    const reservationId = params.metadata!.reservationId as string;
    const raw = eventBody("checkout.session.completed", sessionObject({ id: "cs_route", reservationId }), "evt_route_1");
    const headers = { "stripe-signature": stripe.sign(raw) };
    const first = await webhookPOST(post("/api/stripe/webhook", raw, headers));
    const second = await webhookPOST(post("/api/stripe/webhook", raw, headers));
    expect(first.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect((await store.listOrders(100)).filter((o) => o.id === reservationId)).toHaveLength(1);
    expect(await stock(HOODIE)).toBe(2);
  });

  it("answers 503 (so Stripe retries) when the store isn't configured", async () => {
    __setStoreForTests(null);
    const raw = eventBody("customer.created", { id: "cus_1" });
    expect((await webhookPOST(post("/api/stripe/webhook", raw, { "stripe-signature": stripe.sign(raw) }))).status).toBe(503);
  });
});

describe("POST /api/checkout", () => {
  it("answers 503 when Redis or Stripe isn't configured", async () => {
    __setStoreForTests(null);
    const res = await checkoutPOST(post("/api/checkout", { items: [{ ...HOODIE, qty: 1 }] }));
    expect(res.status).toBe(503);
  });
  it("refuses a live Stripe key that hasn't been approved", async () => {
    __setStripeForTests(undefined);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_dummy");
    const res = await checkoutPOST(post("/api/checkout", { items: [{ ...HOODIE, qty: 1 }] }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Checkout isn't open yet. Join early access to hear when it is."); // shoppers never see the technical reason
    expect(log).toHaveBeenCalledWith("[checkout] not available:", expect.stringMatching(/Live payments are switched off/)); // the owner does, in the log
  });
  it("rejects malformed JSON", async () => {
    expect((await checkoutPOST(post("/api/checkout", "{not json"))).status).toBe(400);
  });
});

describe("GET /api/checkout/cancel", () => {
  it("redirects to the shop and frees the held stock", async () => {
    await setStock(HOODIE, 2);
    await checkoutPOST(post("/api/checkout", { items: [{ ...HOODIE, qty: 2 }] }, { "x-forwarded-for": "198.51.100.7" }));
    const id = stripe.create.mock.calls.at(-1)![0].metadata!.reservationId as string;
    expect(await stock(HOODIE)).toBe(0);
    const res = await cancelGET(new Request(`https://lsw.test/api/checkout/cancel?r=${id}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://lsw.test/shop?checkout=canceled");
    expect(await stock(HOODIE)).toBe(2);
  });
  it("ignores malformed reservation ids", async () => {
    const res = await cancelGET(new Request("https://lsw.test/api/checkout/cancel?r=../../etc"));
    expect(res.status).toBe(303);
  });
});

describe("GET /api/availability/[slug]", () => {
  it("reports can-buy booleans and never exposes stock counts", async () => {
    await setStock(HOODIE, 4);
    const res = await availabilityGET(new Request("https://lsw.test/x"), { params: Promise.resolve({ slug: HOODIE.slug }) });
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.variants[`${HOODIE.colorId}:${HOODIE.size}`]).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/\b4\b/);
    expect(Object.values(body.variants).every((v) => typeof v === "boolean")).toBe(true);
  });
  it("says not-configured (preview mode) when there's no store, and 404s unknown products", async () => {
    __setStoreForTests(null);
    const preview = await availabilityGET(new Request("https://lsw.test/x"), { params: Promise.resolve({ slug: HOODIE.slug }) });
    expect(await preview.json()).toEqual({ configured: false, variants: {} });
    const missing = await availabilityGET(new Request("https://lsw.test/x"), { params: Promise.resolve({ slug: "nope" }) });
    expect(missing.status).toBe(404);
  });
});

describe("admin and cron endpoints", () => {
  const auth = { authorization: `Bearer ${ADMIN}` };
  it("rejects missing, wrong and weak tokens", async () => {
    expect((await adminGET(new Request("https://lsw.test/a"))).status).toBe(401);
    expect((await adminGET(new Request("https://lsw.test/a", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    vi.stubEnv("ADMIN_TOKEN", "short"); // refuses to run with a weak token even if it matches
    expect((await adminGET(new Request("https://lsw.test/a", { headers: { authorization: "Bearer short" } }))).status).toBe(401);
  });
  it("sets and adds stock, and refuses to go below zero", async () => {
    const set = await adminPOST(post("/api/admin/inventory", { ...HOODIE, qty: 5, mode: "set" }, auth));
    expect((await set.json()).results[0]).toMatchObject({ available: 5, ok: true });
    const add = await adminPOST(post("/api/admin/inventory", { ...HOODIE, qty: -2, mode: "add" }, auth));
    expect((await add.json()).results[0]).toMatchObject({ available: 3, ok: true });
    const tooMuch = await adminPOST(post("/api/admin/inventory", { ...HOODIE, qty: -9, mode: "add" }, auth));
    expect((await tooMuch.json()).results[0]).toMatchObject({ available: null, ok: false });
    expect(await stock(HOODIE)).toBe(3);
  });
  it("validates what it is asked to change", async () => {
    for (const bad of [{ ...HOODIE, slug: "nope", qty: 1, mode: "set" }, { ...HOODIE, size: "XXXL", qty: 1, mode: "set" }, { ...HOODIE, qty: -1, mode: "set" }, { ...HOODIE, qty: 1.5, mode: "set" }, { ...HOODIE, qty: 1 }]) {
      expect((await adminPOST(post("/api/admin/inventory", bad, auth))).status).toBe(400);
    }
  });
  it("cron sweep needs its secret", async () => {
    expect((await sweepGET(new Request("https://lsw.test/c"))).status).toBe(401);
    const ok = await sweepGET(new Request("https://lsw.test/c", { headers: { authorization: "Bearer cron-secret-value" } }));
    expect(ok.status).toBe(200);
  });
});
