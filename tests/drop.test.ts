// DROP 001 release clock and early-access passes: parsing, phases, signatures, and the checkout API gate.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CommerceConfig } from "../lib/commerce/config.ts";
import { handleCheckoutRequest, PASS_CHECKOUT_LIMIT } from "../lib/commerce/http.ts";
import { checkoutGate, dropClock, dropPhase, EARLY_ACCESS_COOKIE, parseInstant, readCookie, signPass, verifyPass } from "../lib/drop.ts";

const SECRET = "x".repeat(40);
const OPEN = Date.parse("2026-11-20T22:00:00Z");
const EARLY = Date.parse("2026-11-19T22:00:00Z");
const env = { NEXT_PUBLIC_LAUNCH_DATE: "2026-11-20T17:00:00-05:00", DROP_EARLY_ACCESS_AT: "2026-11-19T22:00:00Z", EARLY_ACCESS_SECRET: SECRET };

describe("release clock", () => {
  test("only full timestamps with a timezone are accepted", () => {
    assert.equal(parseInstant("2026-11-20T17:00:00-05:00"), OPEN);
    assert.equal(parseInstant("2026-11-20"), null, "a bare date would mean midnight in some unknown zone");
    assert.equal(parseInstant("2026-11-20T17:00:00"), null, "no timezone");
    assert.equal(parseInstant("soon"), null);
    assert.equal(parseInstant(""), null);
  });

  test("phases follow one absolute clock", () => {
    const c = dropClock(env);
    assert.equal(dropPhase(c, EARLY - 1), "upcoming");
    assert.equal(dropPhase(c, EARLY), "early");
    assert.equal(dropPhase(c, OPEN - 1), "early");
    assert.equal(dropPhase(c, OPEN), "open");
    assert.equal(dropPhase(dropClock({}), OPEN), "unscheduled");
  });

  test("an early window after opening, or a short secret, is ignored", () => {
    assert.equal(dropClock({ ...env, DROP_EARLY_ACCESS_AT: "2026-11-21T00:00:00Z" }).earlyAt, null);
    assert.equal(dropClock({ ...env, EARLY_ACCESS_SECRET: "short" }).secret, null);
  });
});

describe("early-access passes", () => {
  test("valid pass verifies; tampered, expired or wrong-key passes do not", () => {
    const t = signPass("sub1", OPEN, SECRET);
    assert.deepEqual(verifyPass(t, SECRET, EARLY), { id: "sub1", exp: OPEN });
    assert.equal(verifyPass(t, SECRET, OPEN), null, "expired at opening");
    assert.equal(verifyPass(t, "y".repeat(40), EARLY), null);
    const [body, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ id: "sub1", exp: OPEN + 9e9 })).toString("base64url");
    assert.equal(verifyPass(`${forged}.${mac}`, SECRET, EARLY), null);
    assert.equal(verifyPass(`${body}.`, SECRET, EARLY), null);
    assert.equal(verifyPass("garbage", SECRET, EARLY), null);
    assert.equal(verifyPass(t, null, EARLY), null, "no secret configured = no pass is valid");
  });

  test("gate: closed before the window, pass-only during it, open after", () => {
    const c = dropClock(env);
    const t = signPass("sub1", OPEN, SECRET);
    assert.equal(checkoutGate(c, EARLY - 1, t).open, false, "a pass does not open the store before the early window");
    assert.equal(checkoutGate(c, EARLY + 1, null).open, false);
    assert.deepEqual(checkoutGate(c, EARLY + 1, t), { open: true, passId: "sub1" });
    assert.deepEqual(checkoutGate(c, OPEN, null), { open: true });
    assert.deepEqual(checkoutGate(dropClock({}), 0, null), { open: true }, "no date set behaves as before");
  });

  test("cookie parsing", () => {
    assert.equal(readCookie(`a=1; ${EARLY_ACCESS_COOKIE}=abc.def; b=2`, EARLY_ACCESS_COOKIE), "abc.def");
    assert.equal(readCookie("x_lsw_ea=nope", EARLY_ACCESS_COOKIE), null);
    assert.equal(readCookie(null, EARLY_ACCESS_COOKIE), null);
  });
});

describe("checkout API enforces the clock", () => {
  const buckets = new Map<string, number>();
  const cfg = {
    ok: true,
    mode: "test",
    store: {
      async allow(b: string, limit: number) {
        const n = (buckets.get(b) ?? 0) + 1;
        buckets.set(b, n);
        return n <= limit;
      },
      sweepExpired: async () => 0,
      reserve: async () => ({ ok: false, reason: "duplicate" }),
    },
    stripe: {},
  } as unknown as CommerceConfig;
  const req = (cookie?: string, ip = "1.1.1.1") =>
    new Request("http://x/api/checkout", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(cookie && { cookie }) }, body: JSON.stringify({ lines: [{ sku: "LSW001-TEE-WASHED-BLACK-M", qty: 1 }] }) });
  const deps = (now: number) => ({ cfg, liveMode: false, requestOrigin: "http://x", drop: dropClock(env), now: () => now, log: () => {} });

  test("before opening: 403 with the opening time, nothing reserved", async () => {
    const res = await handleCheckoutRequest(req(), deps(EARLY - 1));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.opensAt, OPEN);
    assert.match(body.error, /opens November 20, 2026/);
  });

  test("early window: a pass gets through to reservation, limited per pass", async () => {
    const cookie = `${EARLY_ACCESS_COOKIE}=${signPass("sub-limit", OPEN, SECRET)}`;
    for (let i = 0; i < PASS_CHECKOUT_LIMIT; i++) {
      const res = await handleCheckoutRequest(req(cookie, `9.9.9.${i}`), deps(EARLY + 1));
      assert.equal(res.status, 409, "reached reservation (the fake store reports a duplicate)");
    }
    const res = await handleCheckoutRequest(req(cookie, "9.9.9.99"), deps(EARLY + 1));
    assert.equal(res.status, 429);
  });

  test("after opening: no pass needed", async () => {
    const res = await handleCheckoutRequest(req(undefined, "2.2.2.2"), deps(OPEN + 1));
    assert.equal(res.status, 409);
  });
});
