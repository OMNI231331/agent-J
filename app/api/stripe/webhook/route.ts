import { commerceConfig } from "@/lib/commerce/config";
import { handleWebhookRequest } from "@/lib/commerce/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe → LSW. The raw body is verified against STRIPE_WEBHOOK_SECRET before anything is parsed.
 * 400 = bad signature (Stripe won't retry usefully); 500 = our infrastructure failed (Stripe retries).
 * Stripe must be configured too: an oversold late payment is refunded through it.
 */
export async function POST(req: Request) {
  const cfg = commerceConfig();
  return handleWebhookRequest(req, { secret: process.env.STRIPE_WEBHOOK_SECRET, store: cfg.ok ? cfg.store : null, refunds: cfg.ok ? cfg.stripe : undefined });
}
