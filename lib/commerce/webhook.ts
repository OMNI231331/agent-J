import type { CheckoutSession } from "./stripe.ts";
import type { InventoryStore, OrderStatus } from "./store.ts";

export type StripeEvent = { id: string; type: string; data: { object: CheckoutSession } };
export type HandleResult = { handled: boolean; duplicate?: boolean; outcome?: string };

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

/**
 * Idempotent: a duplicate delivery returns early; and even if two copies race, every state change
 * underneath is guarded by the reservation/order status, so stock and orders change at most once.
 * Throws on infrastructure errors so the route returns 500 and Stripe retries.
 */
export async function handleStripeEvent(event: StripeEvent, store: InventoryStore, now: () => number = Date.now): Promise<HandleResult> {
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
    };
    const order = (status: OrderStatus, note?: string) => store.upsertOrder(session.id, status, note ? { ...details, note } : details, now());
    const commitAndRecord = async () => {
      const c = await store.commit(resId);
      if (c === "committed" || c === "recommitted" || c === "already:committed") await order("paid");
      else await order("needs_attention", `Paid, but stock could not be confirmed (${c}). Refund or fulfil manually.`);
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
