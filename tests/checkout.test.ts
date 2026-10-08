import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_UNITS_PER_ORDER, RATE_LIMIT_MAX, SESSION_MINUTES, cancelReservation, createCheckout, validateCart } from "@/lib/checkout/create";
import { keyProblem } from "@/lib/checkout/stripe";
import { HOODIE, TEE, fakeStripe, makeStore } from "./helpers";

const ctx = makeStore();
const { store, stock, setStock } = ctx;
afterAll(() => ctx.close());

const SITE = "https://lsw.test";
const line = (v: { slug: string; colorId: string; size: string }, qty = 1, extra: Record<string, unknown> = {}) => ({ ...v, qty, ...extra });
let client = 0;
const run = (items: unknown, deps: { stripe: ReturnType<typeof fakeStripe>; now?: () => number; clientId?: string }) =>
  createCheckout({ items, clientId: deps.clientId ?? `client-${++client}` }, { store, stripe: deps.stripe.stripe, siteUrl: SITE, now: deps.now });

describe("server-side validation", () => {
  const bad: [string, unknown][] = [
    ["not an array", { slug: "signature-hoodie" }],
    ["empty bag", []],
    ["more than 20 lines", Array.from({ length: 21 }, () => line(HOODIE))],
    ["unknown product", [line({ ...HOODIE, slug: "free-hoodie" })]],
    ["unknown color", [line({ ...HOODIE, colorId: "hot-pink" })]],
    ["size the product does not come in", [line({ ...HOODIE, size: "XXXL" })]],
    ["color that product does not come in", [line({ ...HOODIE, colorId: "cream" })]],
    ["quantity 0", [line(HOODIE, 0)]],
    ["negative quantity", [line(HOODIE, -1)]],
    ["fractional quantity", [line(HOODIE, 1.5)]],
    ["quantity as a string", [line(HOODIE, "2" as unknown as number)]],
    ["quantity over the per-line limit", [line(HOODIE, 11)]],
    ["null line", [null]],
  ];

  it.each(bad)("rejects: %s", async (_name, items) => {
    await setStock(HOODIE, 5);
    const s = fakeStripe();
    const r = await run(items, { stripe: s });
    expect(r.status).toBe(400);
    expect(s.create).not.toHaveBeenCalled();
    expect(await stock(HOODIE)).toBe(5);
  });

  it("rejects an order over the total unit limit, even when each line is fine", () => {
    const v = validateCart([line(HOODIE, 6), line(TEE, MAX_UNITS_PER_ORDER - 5)]);
    expect(v.ok).toBe(false);
  });

  it("merges duplicate lines for the same variant into one", () => {
    const v = validateCart([line(HOODIE, 3), line(HOODIE, 4)]);
    expect(v).toEqual({ ok: true, lines: [{ ...HOODIE, qty: 7 }] });
  });
});

describe("pricing comes from the catalog, never the browser", () => {
  it("ignores a price sent by the client", async () => {
    await setStock(HOODIE, 5);
    const s = fakeStripe();
    const r = await run([line(HOODIE, 1, { price: 1, unitAmount: 1, unit_amount: 1, amount: 1 })], { stripe: s });
    expect(r.status).toBe(200);
    const params = s.create.mock.calls[0][0];
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(12000); // $120.00 from lib/lsw.ts
    expect(params.line_items?.[0]?.quantity).toBe(1);
  });
});

describe("a successful checkout", () => {
  beforeEach(() => setStock(HOODIE, 5));

  it("holds the stock, opens a Stripe session that lives 30+ minutes, and links the two", async () => {
    const s = fakeStripe();
    const now = Date.now();
    const r = await run([line(HOODIE, 2)], { stripe: s, now: () => now });
    expect(r).toMatchObject({ status: 200, body: { url: expect.stringContaining("checkout.stripe.test") } });
    expect(await stock(HOODIE)).toBe(3);

    const params = s.create.mock.calls[0][0];
    const reservationId = params.metadata?.reservationId as string;
    expect(reservationId).toMatch(/^res_/);
    expect(params.client_reference_id).toBe(reservationId);
    expect(params.mode).toBe("payment");
    expect(params.success_url).toContain(`${SITE}/checkout/success`);
    expect(params.cancel_url).toBe(`${SITE}/api/checkout/cancel?r=${reservationId}`);
    expect(params.expires_at! - Math.floor(now / 1000)).toBeGreaterThanOrEqual(30 * 60);
    expect(params.expires_at! - Math.floor(now / 1000)).toBe(SESSION_MINUTES * 60);

    const res = await store.getReservation(reservationId);
    expect(res).toMatchObject({ state: "held", sessionId: "cs_test_1", subtotal: 24000 });
    // the hold outlives the Stripe session so only truly abandoned holds get swept
    expect(res!.expiresAt).toBeGreaterThan(params.expires_at! * 1000);
  });
});

describe("overselling", () => {
  it("refuses a sold-out item and never calls Stripe", async () => {
    await setStock(HOODIE, 0);
    const s = fakeStripe();
    const r = await run([line(HOODIE)], { stripe: s });
    expect(r.status).toBe(409);
    expect(s.create).not.toHaveBeenCalled();
  });

  it("15 shoppers checking out at once for the last hoodie: exactly one gets a Stripe session", async () => {
    await setStock(HOODIE, 1);
    const s = fakeStripe();
    const results = await Promise.all(Array.from({ length: 15 }, () => run([line(HOODIE)], { stripe: s })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(14);
    expect(s.create).toHaveBeenCalledTimes(1);
    expect(await stock(HOODIE)).toBe(0);
  });
});

describe("failures", () => {
  it("gives the stock back if Stripe is down", async () => {
    await setStock(HOODIE, 3);
    const s = fakeStripe({ failCreate: true });
    const r = await run([line(HOODIE, 2)], { stripe: s });
    expect(r.status).toBe(502);
    expect(await stock(HOODIE)).toBe(3);
  });

  it("rate-limits one visitor who keeps opening checkouts", async () => {
    await setStock(HOODIE, 100);
    const s = fakeStripe();
    const same = "greedy-client";
    const codes: number[] = [];
    for (let i = 0; i < RATE_LIMIT_MAX + 2; i++) codes.push((await run([line(HOODIE)], { stripe: s, clientId: same })).status);
    expect(codes.slice(0, RATE_LIMIT_MAX).every((c) => c === 200)).toBe(true);
    expect(codes.slice(RATE_LIMIT_MAX)).toEqual([429, 429]);
    expect((await run([line(HOODIE)], { stripe: s })).status).toBe(200); // other visitors are unaffected
  });
});

describe("canceled and abandoned checkouts", () => {
  const start = async (s: ReturnType<typeof fakeStripe>, now?: () => number) => {
    await run([line(HOODIE, 2)], { stripe: s, now });
    return s.create.mock.calls.at(-1)![0].metadata!.reservationId as string;
  };
  beforeEach(() => setStock(HOODIE, 5));

  it("cancel expires the Stripe session first, then frees the stock", async () => {
    const s = fakeStripe();
    const id = await start(s);
    expect(await stock(HOODIE)).toBe(3);
    expect(await cancelReservation(id, { store, stripe: s.stripe })).toBe("released");
    expect(s.expire).toHaveBeenCalledWith("cs_test_1");
    expect(await stock(HOODIE)).toBe(5);
    expect(await cancelReservation(id, { store, stripe: s.stripe })).toBe("nothing"); // pressing back twice is harmless
    expect(await stock(HOODIE)).toBe(5);
  });

  it("cancel does NOT free stock when Stripe says the session can't be expired (customer may have just paid)", async () => {
    const s = fakeStripe({ failExpire: true });
    const id = await start(s);
    expect(await cancelReservation(id, { store, stripe: s.stripe })).toBe("left_to_webhook");
    expect(await stock(HOODIE)).toBe(3);
  });

  it("an abandoned hold is returned by the sweep after it expires", async () => {
    const iso = makeStore(); // its own key prefix, so other tests' holds can't be swept into this one
    try {
      await iso.setStock(HOODIE, 5);
      const s = fakeStripe();
      const t0 = Date.now();
      await createCheckout({ items: [line(HOODIE, 2)], clientId: "iso" }, { store: iso.store, stripe: s.stripe, siteUrl: SITE, now: () => t0 });
      expect(await iso.stock(HOODIE)).toBe(3);
      expect(await iso.store.sweepExpired(t0 + 20 * 60_000)).toEqual([]); // still inside the checkout window
      expect(await iso.stock(HOODIE)).toBe(3);
      expect((await iso.store.sweepExpired(t0 + 60 * 60_000)).length).toBe(1);
      expect(await iso.stock(HOODIE)).toBe(5);
    } finally {
      await iso.close();
    }
  });

  it("the next checkout sweeps expired holds first, so abandoned stock is sellable again", async () => {
    await setStock(HOODIE, 1);
    const s = fakeStripe();
    const t0 = Date.now() - 2 * 60 * 60_000; // an abandoned checkout from two hours ago
    await run([line(HOODIE)], { stripe: s, now: () => t0 });
    expect(await stock(HOODIE)).toBe(0);
    const r = await run([line(HOODIE)], { stripe: s }); // now = real time
    expect(r.status).toBe(200);
  });
});

describe("live-payment guard", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("accepts test keys, refuses live keys unless explicitly allowed, and refuses a missing key", () => {
    expect(keyProblem("sk_test_abc")).toBeNull();
    expect(keyProblem("sk_live_abc")).toMatch(/Live payments are switched off/);
    expect(keyProblem("rk_live_abc")).toMatch(/Live payments are switched off/);
    expect(keyProblem(undefined)).toMatch(/isn't configured/);
    vi.stubEnv("ALLOW_LIVE_PAYMENTS", "true");
    expect(keyProblem("sk_live_abc")).toBeNull();
  });
});
