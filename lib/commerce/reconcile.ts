import type { InventoryStore } from "./store.ts";
import { stripeBase, type CheckoutSession, type StripeApi } from "./stripe.ts";
import { handleStripeEvent, type Log } from "./webhook.ts";

/** Completed Checkout Sessions Stripe has recorded since `sinceSec` (unix seconds). Read-only. */
export async function listCompletedSessions(secretKey: string, sinceSec: number, fetchImpl: typeof fetch = fetch): Promise<CheckoutSession[]> {
  const out: CheckoutSession[] = [];
  let after: string | undefined;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ limit: "100", status: "complete", "created[gte]": String(sinceSec) });
    if (after) q.set("starting_after", after);
    const res = await fetchImpl(`${stripeBase(secretKey)}/checkout/sessions?${q}`, { headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": "2024-06-20" } });
    const data = (await res.json().catch(() => null)) as { data?: CheckoutSession[]; has_more?: boolean; error?: { message?: string } } | null;
    if (!res.ok || !data?.data) throw new Error(data?.error?.message ?? `Stripe list failed (${res.status})`);
    out.push(...data.data);
    if (!data.has_more || !data.data.length) break;
    after = data.data[data.data.length - 1].id;
  }
  return out;
}

export type ReconcileReport = {
  checked: number;
  ok: number;
  /** Not one of ours (no reservation id): ignored. */
  skipped: number;
  /** Stripe has a completed session but Redis has no order for it. */
  missing: string[];
  mismatched: { sessionId: string; problem: string }[];
  /** Fixed by replaying the session through the normal webhook handler (only with apply). */
  repaired: string[];
};

const isPaid = (s: CheckoutSession) => s.payment_status === "paid" || s.payment_status === "no_payment_required";

/**
 * Compares Stripe (the record of payments) with the orders in Redis. With `apply`, a missing or behind-the-times order is
 * rebuilt by replaying the session through handleStripeEvent, which is idempotent, so running this twice is harmless.
 * Amount differences are reported, never auto-changed.
 */
export async function reconcile(
  store: InventoryStore,
  sessions: CheckoutSession[],
  opts: { apply: boolean; now?: () => number; log?: Log; refunds?: Pick<StripeApi, "createRefund"> } = { apply: false },
): Promise<ReconcileReport> {
  const report: ReconcileReport = { checked: 0, ok: 0, skipped: 0, missing: [], mismatched: [], repaired: [] };
  const now = opts.now ?? Date.now;
  for (const s of sessions) {
    if (!(s.metadata?.reservation_id ?? s.client_reference_id)) {
      report.skipped++;
      continue;
    }
    report.checked++;
    const problem = async (): Promise<string | null> => {
      const order = await store.getOrder(s.id);
      if (!order) return "missing";
      if (isPaid(s) && !["paid", "needs_attention", "refunded"].includes(order.status)) return `Stripe says paid but the order is ${order.status}`;
      if (!isPaid(s) && order.status === "paid") return "Order is paid but Stripe says the payment is not complete";
      if (s.amount_total != null && order.details.amountTotal != null && s.amount_total !== order.details.amountTotal)
        return `amount differs: Stripe ${s.amount_total}, order ${order.details.amountTotal}`;
      return null;
    };
    const first = await problem();
    if (!first) {
      report.ok++;
      continue;
    }
    if (first === "missing") report.missing.push(s.id);
    else report.mismatched.push({ sessionId: s.id, problem: first });
    const repairable = first === "missing" || first.startsWith("Stripe says paid");
    if (opts.apply && repairable) {
      // Exactly what the lost webhook would have done, including refunding a payment whose stock was resold.
      await handleStripeEvent({ id: `reconcile:${s.id}`, type: "checkout.session.completed", data: { object: s } }, store, { now, log: opts.log, refunds: opts.refunds });
      if (!(await problem())) report.repaired.push(s.id);
    }
  }
  return report;
}
