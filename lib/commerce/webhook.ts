import type { CheckoutSession, StripeApi } from "./stripe.ts";
import type { InventoryStore, OrderStatus } from "./store.ts";

export type StripeEvent = { id: string; type: string; data: { object: CheckoutSession } };
export type HandleResult = { handled: boolean; duplicate?: boolean; outcome?: string };
export type WebhookDeps = { refunds?: Pick<StripeApi, "createRefund">; now?: () => number };

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

/**
 * Idempotent: a duplicate delivery returns early; and even if two copies race, every state change
 * underneath is guarded by the reservation/order status, so stock and orders change at most once.
 * Throws on infrastructure errors (including a failed refund) so the route returns 500 and Stripe retries —
 * every step below is safe to run again, and a retried refund reuses its Stripe idempotency key.
 */
export async function handleStripeEvent(event: StripeEvent, store: InventoryStore, deps: WebhookDeps = {}): Promise<HandleResult> {
  const now = deps.now ?? Date.now;
  if (!HANDLED.has(event.type)) return { handled: false };
  if (await store.isEventProcessed(event.id)) return { handled: true, duplicate: true };

  const session = event.data.object;
  const resId = session.metadata?.reservation_id ?? session.client_reference_id ?? null;
  let outcome = "ignored:no_reservation";

  if (resId) {
    const reservation = await store.getReservation(resId);
    const details = {
      reservationId: resId,
      lines: reservation?.lines ?? [],
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      email: session.customer_details?.email ?? null,
      paymentIntent: session.payment_intent ?? null,
    };
    const order = (status: OrderStatus, note?: string) => store.upsertOrder(session.id, status, note ? { ...details, note } : details, now());

    // The amount Stripe charged for the goods must equal what we reserved at server-side catalog prices.
    const expected = reservation?.subtotalCents;
    const charged = session.amount_subtotal;
    const mismatch = expected !== undefined && charged != null && charged !== expected ? `Stripe charged a subtotal of ${charged} but ${expected} was reserved. Check this order before shipping.` : undefined;

    const refundOversold = async (): Promise<string> => {
      const pi = session.payment_intent;
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
  return { handled: true, outcome };
}
