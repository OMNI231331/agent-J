import { randomUUID } from "node:crypto";
import { findSku } from "../catalog.ts";
import { StripeError, type StripeApi } from "./stripe.ts";
import type { InventoryStore, Line } from "./store.ts";
import { validateCart } from "./validate.ts";

/** Stripe requires expires_at at least 30 minutes out; 31 avoids clock-skew rejections. */
export const SESSION_TTL_MS = 31 * 60 * 1000;
/** Stock stays held a little longer than the session can live, so a just-in-time payment never loses its stock. */
export const RESERVATION_GRACE_MS = 10 * 60 * 1000;

export type CheckoutDeps = {
  store: InventoryStore;
  stripe: StripeApi;
  origin: string;
  liveMode: boolean;
  now?: () => number;
  newId?: () => string;
  shippingRateId?: string;
  automaticTax?: boolean;
};
export type CheckoutResult = { ok: true; url: string; reservationId: string } | { ok: false; status: number; error: string };

export async function startCheckout(input: unknown, deps: CheckoutDeps): Promise<CheckoutResult> {
  const now = deps.now ?? Date.now;
  const v = validateCart(input, { liveMode: deps.liveMode });
  if (!v.ok) return v;

  // Return stock from abandoned checkouts first, so it is available to this customer.
  await deps.store.sweepExpired(now()).catch(() => 0);

  const id = (deps.newId ?? randomUUID)();
  const sessionExpiresAt = now() + SESSION_TTL_MS;
  const reserved = await deps.store.reserve(id, v.lines, sessionExpiresAt + RESERVATION_GRACE_MS);
  if (!reserved.ok) {
    if (reserved.reason === "duplicate") return { ok: false, status: 409, error: "Please try again." };
    const hit = findSku(reserved.sku);
    const label = hit ? `${hit.product.name} (${hit.variant.size})` : "An item";
    return {
      ok: false,
      status: 409,
      error: reserved.available ? `Not enough stock: ${label}. Please lower the quantity.` : `${label} is sold out or not yet in stock.`,
    };
  }

  try {
    const session = await deps.stripe.createCheckoutSession(sessionParams(id, v.lines, sessionExpiresAt, deps), id);
    if (!session.url) throw new StripeError("Stripe returned no checkout URL", 502);
    const subtotal = v.lines.reduce((sum, l) => sum + findSku(l.sku)!.product.priceCents * l.qty, 0);
    await deps.store.attachSession(id, session.id, subtotal);
    return { ok: true, url: session.url, reservationId: id };
  } catch (e) {
    await deps.store.release(id, "stripe_error").catch(() => undefined);
    console.error("checkout: Stripe session failed", e instanceof Error ? e.message : e);
    return { ok: false, status: 502, error: "We couldn't start checkout. Please try again." };
  }
}

function sessionParams(id: string, lines: Line[], expiresAtMs: number, deps: CheckoutDeps): URLSearchParams {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("client_reference_id", id);
  p.set("metadata[reservation_id]", id);
  p.set("payment_intent_data[metadata][reservation_id]", id);
  p.set("expires_at", String(Math.floor(expiresAtMs / 1000)));
  p.set("success_url", `${deps.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${deps.origin}/checkout/cancelled?r=${encodeURIComponent(id)}`);
  p.set("shipping_address_collection[allowed_countries][0]", "US");
  if (deps.shippingRateId) p.set("shipping_options[0][shipping_rate]", deps.shippingRateId);
  if (deps.automaticTax) p.set("automatic_tax[enabled]", "true");
  lines.forEach((l, i) => {
    const { product, variant } = findSku(l.sku)!;
    p.set(`line_items[${i}][quantity]`, String(l.qty));
    p.set(`line_items[${i}][price_data][currency]`, "usd");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(product.priceCents));
    p.set(`line_items[${i}][price_data][product_data][name]`, product.name);
    p.set(`line_items[${i}][price_data][product_data][description]`, `${variant.color.replace(/-/g, " ")} / ${variant.size}`);
    p.set(`line_items[${i}][price_data][product_data][metadata][sku]`, l.sku);
  });
  return p;
}

/**
 * Customer pressed "back" on the Stripe page. Expire the session so it can't be paid later,
 * then return the stock. Never releases stock for a completed (paid) session.
 */
export async function cancelCheckout(reservationId: string, deps: { store: InventoryStore; stripe: StripeApi }): Promise<"released" | "noop"> {
  const r = await deps.store.getReservation(reservationId);
  if (!r || r.status !== "reserved") return "noop";
  if (r.sessionId) {
    let s = await deps.stripe.retrieveCheckoutSession(r.sessionId);
    if (s.status === "complete") return "noop";
    if (s.status === "open") s = await deps.stripe.expireCheckoutSession(r.sessionId);
    if (s.status !== "expired") return "noop";
  }
  return (await deps.store.release(reservationId, "canceled")) === "released" ? "released" : "noop";
}
