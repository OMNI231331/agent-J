import { findSku } from "../catalog.ts";
import type { CheckoutSession, StripeApi } from "./stripe.ts";
import type { InventoryStore, OrderDetails, OrderItem, OrderStatus, Reservation } from "./store.ts";

export type StripeEvent = { id: string; type: string; data: { object: CheckoutSession } };
export type HandleResult = { handled: boolean; duplicate?: boolean; outcome?: string };

/** One JSON object per line, so Vercel's log search can filter it. Callers must never put customer data in an entry. */
export type Log = (entry: Record<string, unknown>) => void;
export const jsonLog: Log = (entry) => console.log(JSON.stringify({ app: "lsw", at: new Date().toISOString(), ...entry }));

export type WebhookDeps = { refunds?: Pick<StripeApi, "createRefund">; now?: () => number; log?: Log };

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

/** Stripe sends the PaymentIntent as an id string, or as an object when the event was expanded. */
export const paymentIntentId = (s: CheckoutSession): string | null => (typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null));

/** Builds the order record from the reservation (what we reserved) and the session (what Stripe says happened). */
export function buildOrderDetails(resId: string, reservation: Reservation | null, session: CheckoutSession): OrderDetails {
  const lines = reservation?.lines ?? [];
  const items: OrderItem[] = lines.map((l) => {
    const hit = findSku(l.sku);
    return {
      sku: l.sku,
      name: hit?.product.name ?? l.sku,
      variant: hit ? `${hit.variant.color.replace(/-/g, " ")} / ${hit.variant.size}` : "",
      qty: l.qty,
      catalogUnitCents: hit?.product.priceCents ?? null,
    };
  });
  const ship = session.collected_information?.shipping_details ?? session.shipping_details ?? null;
  return {
    reservationId: resId,
    lines,
    items,
    amountTotal: session.amount_total ?? null,
    amountSubtotal: session.amount_subtotal ?? null,
    currency: session.currency ?? null,
    email: session.customer_details?.email ?? null,
    customerName: session.customer_details?.name ?? null,
    paymentIntent: paymentIntentId(session),
    shipping: ship ? { name: ship.name ?? null, address: ship.address ?? {} } : null,
  };
}

/**
 * Idempotent: a duplicate delivery returns early; and even if two copies race, every state change
 * underneath is guarded by the reservation/order status, so stock and orders change at most once.
 * Throws on infrastructure errors (including a failed refund) so the route returns 500 and Stripe retries —
 * every step below is safe to run again, and a retried refund reuses its Stripe idempotency key.
 * Nothing is marked processed until the work is done, so a retry after a half-finished attempt completes it.
 */
export async function handleStripeEvent(event: StripeEvent, store: InventoryStore, deps: WebhookDeps = {}): Promise<HandleResult> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? jsonLog;
  if (!HANDLED.has(event.type)) return { handled: false };
  if (await store.isEventProcessed(event.id)) {
    log({ evt: "webhook", eventId: event.id, type: event.type, duplicate: true });
    return { handled: true, duplicate: true };
  }

  const session = event.data.object;
  const resId = session.metadata?.reservation_id ?? session.client_reference_id ?? null;
  let outcome = "ignored:no_reservation";

  if (resId) {
    const reservation = await store.getReservation(resId);
    const details = buildOrderDetails(resId, reservation, session);
    const order = (status: OrderStatus, note?: string) => store.upsertOrder(session.id, status, note ? { ...details, note } : details, now());

    // The amount Stripe charged for the goods must equal what we reserved at server-side catalog prices.
    const expected = reservation?.subtotalCents;
    const charged = session.amount_subtotal;
    const mismatch = expected !== undefined && charged != null && charged !== expected ? `Stripe charged a subtotal of ${charged} but ${expected} was reserved. Check this order before shipping.` : undefined;

    const refundOversold = async (): Promise<string> => {
      const pi = details.paymentIntent;
      if (!pi || !deps.refunds) {
        await order("needs_attention", "Paid, but the stock was resold. Refund this customer manually in Stripe.");
        return "oversold_manual_refund";
      }
      await order("needs_attention", "Paid, but the stock was resold. Refund in progress.");
      await deps.refunds.createRefund(pi, `refund_${resId}`, resId); // throws on failure → Stripe retries this event
      await order("refunded", "Paid after the hold expired and the stock was resold; the customer was refunded in full.");
      return "refunded_out_of_stock";
    };

    const commitAndRecord = async (): Promise<string> => {
      const c = await store.commit(resId);
      if (c === "committed" || c === "recommitted" || c === "already:committed") {
        await (mismatch ? order("needs_attention", mismatch) : order("paid"));
        return c;
      }
      // "oversold" (first time) and "already:committed_oversold" (a retry after a failed refund) both land here.
      if (c === "oversold" || c === "already:committed_oversold") return refundOversold();
      await order("needs_attention", `Paid, but stock could not be confirmed (${c}). Refund or fulfil manually.`);
      return c;
    };

    switch (event.type) {
      case "checkout.session.completed":
        if (session.payment_status === "paid" || session.payment_status === "no_payment_required") outcome = await commitAndRecord();
        else {
          outcome = await store.markAwaitingPayment(resId);
          await order("awaiting_payment");
        }
        break;
      case "checkout.session.async_payment_succeeded":
        outcome = await commitAndRecord();
        break;
      case "checkout.session.async_payment_failed":
        outcome = await store.release(resId, "payment_failed");
        await order("payment_failed");
        break;
      case "checkout.session.expired":
        outcome = await store.release(resId, "session_expired");
        break;
    }
  }
  await store.markEventProcessed(event.id);
  log({ evt: "webhook", eventId: event.id, type: event.type, sessionId: session.id, reservationId: resId, outcome });
  return { handled: true, outcome };
}
