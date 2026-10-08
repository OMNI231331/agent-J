import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Stripe-Signature header (scheme v1: HMAC-SHA256 of `${t}.${rawBody}`).
 * Rejects stale timestamps to stop replays. Uses a constant-time compare.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, opts: { toleranceSec?: number; now?: number } = {}): boolean {
  if (!header || !secret) return false;
  const tolerance = opts.toleranceSec ?? 300;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  let t: number | null = null;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") t = Number(v);
    else if (k === "v1" && v) sigs.push(v);
  }
  if (t === null || !Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(now - t) > tolerance) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex"), "utf8");
  return sigs.some((s) => {
    const got = Buffer.from(s, "utf8");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Builds a valid header — used by tests and the local test script, never in request handling. */
export function signStripePayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex")}`;
}

export type CheckoutSession = {
  id: string;
  url?: string | null;
  status?: "open" | "complete" | "expired";
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: string | null } | null;
};

/** Minimal Stripe REST client (no SDK). Runs only on the server; the key never reaches the browser. */
export interface StripeApi {
  createCheckoutSession(params: URLSearchParams, idempotencyKey: string): Promise<CheckoutSession>;
  retrieveCheckoutSession(id: string): Promise<CheckoutSession>;
  expireCheckoutSession(id: string): Promise<CheckoutSession>;
}

export class StripeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function stripeClient(secretKey: string, fetchImpl: typeof fetch = fetch): StripeApi {
  // Test hook: point at a local fake Stripe. Honoured ONLY for test-mode keys, so a live key can never be redirected.
  const base = stripeMode(secretKey) === "test" && process.env.STRIPE_API_BASE ? process.env.STRIPE_API_BASE : "https://api.stripe.com/v1";
  const call = async (method: "GET" | "POST", path: string, body?: URLSearchParams, idem?: string) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}`, "Stripe-Version": "2024-06-20" };
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idem) headers["Idempotency-Key"] = idem;
    const res = await fetchImpl(`${base}${path}`, { method, headers, body });
    const data = (await res.json().catch(() => null)) as (CheckoutSession & { error?: { message?: string } }) | null;
    if (!res.ok || !data) throw new StripeError(data?.error?.message ?? `Stripe request failed (${res.status})`, res.status);
    return data;
  };
  return {
    createCheckoutSession: (params, idem) => call("POST", "/checkout/sessions", params, idem),
    retrieveCheckoutSession: (id) => call("GET", `/checkout/sessions/${encodeURIComponent(id)}`),
    expireCheckoutSession: (id) => call("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`, new URLSearchParams()),
  };
}

export type StripeMode = "test" | "live" | "invalid";
export const stripeMode = (key: string | undefined): StripeMode =>
  key?.startsWith("sk_test_") || key?.startsWith("rk_test_") ? "test" : key?.startsWith("sk_live_") || key?.startsWith("rk_live_") ? "live" : "invalid";
