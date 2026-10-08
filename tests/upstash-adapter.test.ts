import http from "node:http";
import type { AddressInfo } from "node:net";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { __setStoreForTests, getStore } from "@/lib/inventory";
import type { OrderRecord } from "@/lib/inventory/store";
import { HOODIE, TEST_REDIS_PORT } from "./helpers";

// Exercises the REAL @upstash/redis client (the one production uses) against a small local server that speaks
// Upstash's REST protocol (JSON command array in, {"result": ...} out, base64 text when asked) in front of real Redis.
// It is an emulation, not Upstash itself: it proves our adapter and scripts work through that client.

const redis = new Redis({ port: TEST_REDIS_PORT, host: "127.0.0.1", db: 2 });
let server: http.Server;

const b64 = (v: unknown): unknown => (typeof v === "string" ? Buffer.from(v).toString("base64") : Array.isArray(v) ? v.map(b64) : v);

beforeAll(async () => {
  await redis.flushdb();
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      if (req.headers.authorization !== "Bearer test-token") {
        res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      try {
        const encode = req.headers["upstash-encoding"] === "base64";
        const run = async (command: (string | number)[]) => {
          const [cmd, ...args] = command;
          const result = await redis.call(String(cmd), ...args.map(String));
          return { result: encode ? b64(result) : result };
        };
        const parsed = JSON.parse(body);
        // The client batches commands through /pipeline; single commands post to "/".
        const out = req.url?.startsWith("/pipeline") ? await Promise.all((parsed as (string | number)[][]).map(run)) : await run(parsed);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ error: (e as Error).message }));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  vi.stubEnv("UPSTASH_REDIS_REST_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  __setStoreForTests(undefined);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  __setStoreForTests(undefined);
  server.close();
  await redis.quit();
});

const order = (id: string): OrderRecord => ({ id, sessionId: "cs_1", paymentIntent: "pi_1", status: "paid", email: "a@b.co", name: "Ünï Çödé", shipping: { city: "Zürich" }, amountTotal: 12000, amountSubtotal: 12000, currency: "usd", items: [], createdAt: new Date().toISOString() });

describe("production adapter (@upstash/redis client)", () => {
  it("is selected from the UPSTASH_REDIS_REST_* variables", () => {
    expect(getStore()).not.toBeNull();
  });

  it("runs the full stock -> reserve -> commit -> order flow, with text and JSON coming back intact", async () => {
    const store = getStore()!;
    const key = store.stockKey(HOODIE.slug, HOODIE.colorId, HOODIE.size);
    expect(await store.setStock(key, 3)).toBe(3);
    expect(await store.getStock([key, store.stockKey("nope", "x", "y")])).toEqual([3, null]);

    const item = { k: key, ...HOODIE, qty: 2, unitAmount: 12000, name: "Hoodie (Charcoal / M)" };
    expect(await store.reserve({ id: "res_up_1", items: [item], expiresAt: Date.now() + 3_600_000 })).toEqual({ ok: true });
    expect((await store.getStock([key]))[0]).toBe(1);
    await store.attachSession("res_up_1", "cs_up_1");
    expect(await store.getReservation("res_up_1")).toMatchObject({ state: "held", sessionId: "cs_up_1", subtotal: 24000, items: [expect.objectContaining({ qty: 2, name: "Hoodie (Charcoal / M)" })] });

    expect(await store.commit("res_up_1", order("res_up_1"))).toBe("committed");
    expect(await store.commit("res_up_1", order("res_up_1"))).toBe("duplicate");
    const [saved] = await store.listOrders(10);
    expect(saved).toMatchObject({ id: "res_up_1", name: "Ünï Çödé", shipping: { city: "Zürich" } }); // JSON strings were not auto-parsed or mangled
  });

  it("keeps the no-oversell guarantee through the REST client: 30 parallel reservations for 5 units", async () => {
    const store = getStore()!;
    const key = store.stockKey(HOODIE.slug, "washed-black", "S");
    await store.setStock(key, 5);
    const item = { k: key, ...HOODIE, colorId: "washed-black", size: "S", qty: 1, unitAmount: 12000, name: "x" };
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => store.reserve({ id: `res_up_race_${i}`, items: [item], expiresAt: Date.now() + 3_600_000 })));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect((await store.getStock([key]))[0]).toBe(0);
  });

  it("releases, sweeps and claims events through the REST client", async () => {
    const store = getStore()!;
    const key = store.stockKey(HOODIE.slug, "charcoal", "L");
    await store.setStock(key, 2);
    const item = { k: key, ...HOODIE, size: "L", qty: 2, unitAmount: 12000, name: "x" };
    await store.reserve({ id: "res_up_sweep", items: [item], expiresAt: Date.now() - 1000 });
    expect(await store.sweepExpired()).toContain("res_up_sweep");
    expect((await store.getStock([key]))[0]).toBe(2);
    expect(await store.claimEvent("evt_up")).toBe("claimed");
    expect(await store.claimEvent("evt_up")).toBe("processing");
  });
});
