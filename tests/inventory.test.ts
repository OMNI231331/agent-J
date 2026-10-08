import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { OrderRecord, ReservationItem } from "@/lib/inventory/store";
import { HOODIE, TEE, makeStore } from "./helpers";

const ctx = makeStore();
const { store, stock, setStock } = ctx;
afterAll(() => ctx.close());

const item = (v: { slug: string; colorId: string; size: string }, qty = 1): ReservationItem => ({
  k: store.stockKey(v.slug, v.colorId, v.size),
  ...v,
  qty,
  unitAmount: 12000,
  name: `${v.slug} test`,
});
const order = (id: string): OrderRecord => ({
  id,
  sessionId: `cs_${id}`,
  paymentIntent: "pi_1",
  status: "paid",
  email: "a@b.co",
  name: "A",
  shipping: null,
  amountTotal: 12000,
  amountSubtotal: 12000,
  currency: "usd",
  items: [],
  createdAt: new Date().toISOString(),
});
const FAR_FUTURE = Date.now() + 3_600_000;
let n = 0;
const rid = () => `res_test_${++n}_${Math.random().toString(16).slice(2)}`;

describe("stock limits", () => {
  beforeEach(async () => {
    await setStock(HOODIE, 0);
    await setStock(TEE, 0);
  });

  it("refuses to reserve when there is no stock record at all", async () => {
    const r = await store.reserve({ id: rid(), items: [item({ ...HOODIE, size: "XXL" })], expiresAt: FAR_FUTURE });
    expect(r).toMatchObject({ ok: false, reason: "insufficient" });
  });

  it("refuses a quantity above what is left, and leaves the stock untouched", async () => {
    await setStock(HOODIE, 2);
    const r = await store.reserve({ id: rid(), items: [item(HOODIE, 3)], expiresAt: FAR_FUTURE });
    expect(r.ok).toBe(false);
    expect(await stock(HOODIE)).toBe(2);
  });

  it("is all-or-nothing across items: one sold-out item blocks the whole reservation", async () => {
    await setStock(HOODIE, 3);
    await setStock(TEE, 0);
    const r = await store.reserve({ id: rid(), items: [item(HOODIE), item(TEE)], expiresAt: FAR_FUTURE });
    expect(r).toEqual({ ok: false, reason: "insufficient", variants: [store.stockKey(TEE.slug, TEE.colorId, TEE.size)] });
    expect(await stock(HOODIE)).toBe(3);
  });

  it("will not reuse a reservation id", async () => {
    await setStock(HOODIE, 5);
    const id = rid();
    expect((await store.reserve({ id, items: [item(HOODIE)], expiresAt: FAR_FUTURE })).ok).toBe(true);
    expect(await store.reserve({ id, items: [item(HOODIE)], expiresAt: FAR_FUTURE })).toEqual({ ok: false, reason: "exists" });
    expect(await stock(HOODIE)).toBe(4);
  });

  it("adjustStock never goes below zero", async () => {
    await setStock(HOODIE, 2);
    expect(await store.adjustStock(store.stockKey(HOODIE.slug, HOODIE.colorId, HOODIE.size), -3)).toBeNull();
    expect(await stock(HOODIE)).toBe(2);
    expect(await store.adjustStock(store.stockKey(HOODIE.slug, HOODIE.colorId, HOODIE.size), -2)).toBe(0);
  });
});

describe("concurrent purchases", () => {
  beforeEach(async () => {
    await setStock(HOODIE, 0);
    await setStock(TEE, 0);
  });

  it("100 shoppers racing for 7 units: exactly 7 win and stock ends at exactly 0", async () => {
    await setStock(HOODIE, 7);
    const results = await Promise.all(Array.from({ length: 100 }, () => store.reserve({ id: rid(), items: [item(HOODIE)], expiresAt: FAR_FUTURE })));
    expect(results.filter((r) => r.ok)).toHaveLength(7);
    expect(await stock(HOODIE)).toBe(0);
  });

  it("40 shoppers each wanting 2 of 5 units: exactly 2 win and 1 unit is left (never negative)", async () => {
    await setStock(HOODIE, 5);
    const results = await Promise.all(Array.from({ length: 40 }, () => store.reserve({ id: rid(), items: [item(HOODIE, 2)], expiresAt: FAR_FUTURE })));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await stock(HOODIE)).toBe(1);
  });

  it("two-item carts racing for one hoodie and plenty of tees: one hoodie sold, no tee leaked by the losers", async () => {
    await setStock(HOODIE, 1);
    await setStock(TEE, 50);
    const results = await Promise.all(Array.from({ length: 30 }, () => store.reserve({ id: rid(), items: [item(HOODIE), item(TEE)], expiresAt: FAR_FUTURE })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await stock(HOODIE)).toBe(0);
    expect(await stock(TEE)).toBe(49);
  });
});

describe("safe stock updates", () => {
  beforeEach(() => setStock(HOODIE, 10));

  it("release returns the stock exactly once even if called 20 times at once", async () => {
    const id = rid();
    await store.reserve({ id, items: [item(HOODIE, 3)], expiresAt: FAR_FUTURE });
    expect(await stock(HOODIE)).toBe(7);
    const results = await Promise.all(Array.from({ length: 20 }, () => store.release(id, "test")));
    expect(results.filter((r) => r === "released_now")).toHaveLength(1);
    expect(await stock(HOODIE)).toBe(10);
  });

  it("release does nothing to a paid reservation", async () => {
    const id = rid();
    await store.reserve({ id, items: [item(HOODIE, 2)], expiresAt: FAR_FUTURE });
    expect(await store.commit(id, order(id))).toBe("committed");
    expect(await store.release(id, "late_expiry")).toBe("paid");
    expect(await stock(HOODIE)).toBe(8);
  });

  it("commit applied 20 times at once creates exactly one order and does not touch stock again", async () => {
    const id = rid();
    await store.reserve({ id, items: [item(HOODIE, 2)], expiresAt: FAR_FUTURE });
    const results = await Promise.all(Array.from({ length: 20 }, () => store.commit(id, order(id))));
    expect(results.filter((r) => r === "committed")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(19);
    expect(await stock(HOODIE)).toBe(8);
    expect((await store.listOrders()).filter((o) => o.id === id)).toHaveLength(1);
  });

  it("commit on an unknown reservation is reported, not invented", async () => {
    expect(await store.commit("res_does_not_exist", order("x"))).toBe("unknown");
  });
});

describe("abandoned reservations", () => {
  beforeEach(() => setStock(HOODIE, 10));

  it("sweep returns stock only for holds that have expired", async () => {
    const old = rid();
    const fresh = rid();
    const now = Date.now();
    await store.reserve({ id: old, items: [item(HOODIE, 2)], expiresAt: now - 1000 });
    await store.reserve({ id: fresh, items: [item(HOODIE, 3)], expiresAt: now + 3_600_000 });
    expect(await stock(HOODIE)).toBe(5);
    expect(await store.sweepExpired(now)).toEqual([old]);
    expect(await stock(HOODIE)).toBe(7);
  });

  it("sweep never touches a paid reservation", async () => {
    const id = rid();
    const now = Date.now();
    await store.reserve({ id, items: [item(HOODIE, 2)], expiresAt: now - 1000 });
    await store.commit(id, order(id));
    expect(await store.sweepExpired(now)).toEqual([]);
    expect(await stock(HOODIE)).toBe(8);
  });

  it("ten sweeps at once release a hold once", async () => {
    const id = rid();
    const now = Date.now();
    await store.reserve({ id, items: [item(HOODIE, 4)], expiresAt: now - 1000 });
    const results = await Promise.all(Array.from({ length: 10 }, () => store.sweepExpired(now)));
    expect(results.flat()).toEqual([id]);
    expect(await stock(HOODIE)).toBe(10);
  });
});

describe("payment after the hold was released", () => {
  beforeEach(() => setStock(HOODIE, 1));

  it("takes the stock back and keeps the order when the unit is still there", async () => {
    const id = rid();
    await store.reserve({ id, items: [item(HOODIE)], expiresAt: FAR_FUTURE });
    await store.release(id, "swept");
    expect(await stock(HOODIE)).toBe(1);
    expect(await store.reacquire(id, order(id))).toBe("recovered");
    expect(await stock(HOODIE)).toBe(0);
    expect(await store.reacquire(id, order(id))).toBe("paid");
  });

  it("reports insufficient when someone else took the unit, and never drives stock negative", async () => {
    const id = rid();
    await store.reserve({ id, items: [item(HOODIE)], expiresAt: FAR_FUTURE });
    await store.release(id, "swept");
    await store.reserve({ id: rid(), items: [item(HOODIE)], expiresAt: FAR_FUTURE }); // another customer gets it
    expect(await store.reacquire(id, order(id))).toBe("insufficient");
    expect(await stock(HOODIE)).toBe(0);
    expect(await store.markRefundPending(id, { ...order(id), status: "refund_pending" })).toBe("recorded");
    expect((await store.getReservation(id))?.state).toBe("refund_pending");
  });
});

describe("webhook idempotency keys and abuse limits", () => {
  it("only one of 20 simultaneous deliveries of the same event claims it", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => store.claimEvent("evt_same")));
    expect(results.filter((r) => r === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r === "processing")).toHaveLength(19);
    await store.finishEvent("evt_same");
    expect(await store.claimEvent("evt_same")).toBe("done");
  });

  it("an unclaimed (failed) event can be claimed again, a finished one cannot", async () => {
    await store.claimEvent("evt_retry");
    await store.unclaimEvent("evt_retry");
    expect(await store.claimEvent("evt_retry")).toBe("claimed");
    await store.finishEvent("evt_retry");
    await store.unclaimEvent("evt_retry");
    expect(await store.claimEvent("evt_retry")).toBe("done");
  });

  it("hit() counts within the window", async () => {
    const counts = [await store.hit("ip-a", 60), await store.hit("ip-a", 60), await store.hit("ip-b", 60)];
    expect(counts).toEqual([1, 2, 1]);
  });
});
