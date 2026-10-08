import type Stripe from "stripe";
import type { InventoryStore, OrderRecord, Reservation } from "@/lib/inventory/store";
import type { StripeLike } from "./stripe";

type Deps = { store: InventoryStore; stripe: StripeLike; now?: () => number };

export type WebhookResult = { status: number; body: Record<string, unknown> };

function buildOrder(session: Stripe.Checkout.Session, res: Reservation, status: OrderRecord["status"], now: number, note?: string): OrderRecord {
  const pi = session.payment_intent;
  return {
    id: res.id,
    sessionId: session.id,
    paymentIntent: typeof pi === "string" ? pi : (pi?.id ?? null),
    status,
    note,
    email: session.customer_details?.email ?? null,
    name: session.collected_information?.shipping_details?.name ?? session.customer_details?.name ?? null,
    shipping: session.collected_information?.shipping_details ?? null,
    amountTotal: session.amount_total ?? null,
    amountSubtotal: session.amount_subtotal ?? null,
    currency: session.currency ?? null,
    items: res.items.map(({ slug, colorId, size, qty, unitAmount, name }) => ({ slug, colorId, size, qty, unitAmount, name })),
    createdAt: new Date(now).toISOString(),
  };
}

const reservationIdOf = (s: Stripe.Checkout.Session) => s.metadata?.reservationId ?? s.client_reference_id ?? null;

async function fulfil(session: Stripe.Checkout.Session, deps: Deps): Promise<string> {
  const { store, stripe } = deps;
  const now = (deps.now ?? Date.now)();
  const id = reservationIdOf(session);
  if (!id) return "ignored_not_ours";
  const res = await store.getReservation(id);
  // A paid session with no record of it is something a person must look at. Failing makes Stripe retry and flags the endpoint.
  if (!res) throw new Error(`Paid session ${session.id} has no reservation ${id}`);

  // The amount Stripe charged must match what we reserved at server-side catalog prices.
  const mismatch = session.amount_subtotal !== null && session.amount_subtotal !== res.subtotal;
  const status: OrderRecord["status"] = mismatch ? "needs_review" : "paid";
  const note = mismatch ? `Stripe subtotal ${session.amount_subtotal} does not match reserved subtotal ${res.subtotal}` : undefined;
  const order = buildOrder(session, res, status, now, note);

  const committed = await store.commit(id, order, now);
  if (committed === "committed") return "order_created";
  if (committed === "duplicate") return "duplicate_ignored";
  if (committed === "unknown") throw new Error(`Reservation ${id} vanished`);
  if (committed === "refund_pending") return "refund_already_pending";

  // The hold was released (expired or swept) before the payment arrived. Take the stock back if it is still there.
  const back = await store.reacquire(id, { ...order, note: "Paid after the hold expired; stock re-taken", }, now);
  if (back === "recovered") return "order_created_late";
  if (back === "paid") return "duplicate_ignored";
  if (back === "insufficient") {
    await store.markRefundPending(id, { ...order, status: "refund_pending", note: "Paid after the hold expired and the stock was gone; refund issued" }, now);
    const pi = order.paymentIntent;
    if (pi) await stripe.refunds.create({ payment_intent: pi, reason: "requested_by_customer", metadata: { reservationId: id } }, { idempotencyKey: `refund_${id}` });
    return "refunded_out_of_stock";
  }
  return `unexpected_${back}`;
}

export async function handleStripeEvent(event: Stripe.Event, deps: Deps): Promise<string> {
  const now = (deps.now ?? Date.now)();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Card payments are "paid" here. Delayed methods are "unpaid" until async_payment_succeeded arrives.
      return session.payment_status === "paid" ? fulfil(session, deps) : "awaiting_async_payment";
    }
    case "checkout.session.async_payment_succeeded":
      return fulfil(event.data.object, deps);
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const id = reservationIdOf(event.data.object);
      if (!id) return "ignored_not_ours";
      const reason = event.type === "checkout.session.expired" ? "expired" : "async_payment_failed";
      return `release_${await deps.store.release(id, reason, now)}`;
    }
    case "payment_intent.payment_failed": {
      // A declined card inside Checkout lets the customer try another card, so the hold stays until the session expires.
      return "payment_failed_hold_kept";
    }
    default:
      return "ignored_event_type";
  }
}

/** Verifies the signature, applies each event exactly once, and answers with the status Stripe should see. */
export async function processWebhook(args: { raw: string; signature: string | null; secret: string | undefined } & Deps): Promise<WebhookResult> {
  const { raw, signature, secret, store, stripe } = args;
  if (!secret) return { status: 500, body: { error: "Webhook secret not configured." } };
  if (!signature) return { status: 400, body: { error: "Missing signature." } };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return { status: 400, body: { error: "Invalid signature." } };
  }

  const claim = await store.claimEvent(event.id);
  if (claim === "done") return { status: 200, body: { received: true, duplicate: true } };
  if (claim === "processing") return { status: 409, body: { error: "Event is being processed. Retry." } };

  try {
    const outcome = await handleStripeEvent(event, args);
    await store.finishEvent(event.id);
    return { status: 200, body: { received: true, outcome } };
  } catch (err) {
    await store.unclaimEvent(event.id); // let Stripe's retry run it again
    console.error("[webhook] failed", event.id, event.type, err instanceof Error ? err.message : err);
    return { status: 500, body: { error: "Processing failed." } };
  }
}
