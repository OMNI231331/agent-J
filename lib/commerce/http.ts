import { startCheckout } from "./checkout.ts";
import type { CommerceConfig } from "./config.ts";
import type { InventoryStore } from "./store.ts";
import { verifyStripeSignature, type StripeApi } from "./stripe.ts";
import { handleStripeEvent, jsonLog, type Log, type StripeEvent } from "./webhook.ts";

/** Route logic as plain functions (Request in, Response out) so it can be tested without a Next.js server. */

export type CheckoutRequestDeps = {
  cfg: CommerceConfig;
  liveMode: boolean;
  /** NEXT_PUBLIC_SITE_URL */
  siteUrl?: string;
  /** Origin of this request: only used outside live mode. */
  requestOrigin: string;
  shippingRateId?: string;
  automaticTax?: boolean;
  now?: () => number;
  log?: Log;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Where Stripe sends the customer back to. In live mode this must be the configured https site URL, never a value
 * derived from the incoming request (the Host header is not a trustworthy source for a redirect target).
 */
export function resolveOrigin(d: Pick<CheckoutRequestDeps, "siteUrl" | "requestOrigin" | "liveMode">): string | null {
  const configured = d.siteUrl?.trim().replace(/\/+$/, "");
  if (d.liveMode) return configured && /^https:\/\/[^/\s]+$/.test(configured) ? configured : null;
  return configured || d.requestOrigin;
}

export async function handleCheckoutRequest(req: Request, d: CheckoutRequestDeps): Promise<Response> {
  const log = d.log ?? jsonLog;
  if (!d.cfg.ok) return json({ error: d.cfg.error }, 503);
  const origin = resolveOrigin(d);
  if (!origin) {
    log({ evt: "checkout_unavailable", reason: "NEXT_PUBLIC_SITE_URL must be an https URL in live mode" });
    return json({ error: "Checkout isn't open yet." }, 503);
  }
  try {
    // Stops scripts from reserving (hoarding) a limited drop: max 8 checkout starts per IP per 10 minutes.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!(await d.cfg.store.allow(`checkout:${ip}`, 8, 600))) return json({ error: "Too many checkout attempts. Please wait a few minutes and try again." }, 429);
    const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;
    if (!body) return json({ error: "Invalid request." }, 400);
    const result = await startCheckout(body.lines, {
      store: d.cfg.store,
      stripe: d.cfg.stripe,
      origin,
      liveMode: d.liveMode,
      shippingRateId: d.shippingRateId,
      automaticTax: d.automaticTax,
      now: d.now,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ url: result.url });
  } catch (e) {
    // Redis or the network is down. Nothing was reserved that the sweeper won't return. Say so plainly; leak nothing.
    log({ evt: "checkout_error", message: e instanceof Error ? e.message : String(e) });
    return json({ error: "Checkout is temporarily unavailable. Nothing was charged. Please try again in a moment." }, 503);
  }
}

export async function handleWebhookRequest(
  req: Request,
  d: { secret?: string; store: InventoryStore | null; refunds?: Pick<StripeApi, "createRefund">; now?: () => number; log?: Log },
): Promise<Response> {
  const log = d.log ?? jsonLog;
  if (!d.secret || !d.store) return json({ error: "not configured" }, 503);
  const raw = await req.text(); // the signature covers the exact raw bytes, so read the body as text before parsing
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), d.secret)) {
    log({ evt: "webhook_rejected", reason: "invalid_signature" });
    return json({ error: "invalid signature" }, 400);
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "invalid payload" }, 400);
  }
  try {
    return json({ received: true, ...(await handleStripeEvent(event, d.store, { refunds: d.refunds, now: d.now, log })) });
  } catch (e) {
    // 500 makes Stripe retry with backoff for days. The event was not marked processed, so the retry completes the work.
    log({ evt: "webhook_failed", eventId: event.id, type: event.type, message: e instanceof Error ? e.message : String(e) });
    return json({ error: "processing failed" }, 500);
  }
}
