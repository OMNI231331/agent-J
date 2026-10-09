import { commerceConfig } from "@/lib/commerce/config";
import { handleCheckoutRequest } from "@/lib/commerce/http";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reserves stock atomically in Redis, then creates a Stripe Checkout Session. The client sends only SKU + qty (+ displayed price). */
export async function POST(req: Request) {
  return handleCheckoutRequest(req, {
    cfg: commerceConfig(),
    liveMode: site.mode === "live",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: new URL(req.url).origin,
    shippingRateId: process.env.STRIPE_SHIPPING_RATE_ID || undefined,
    automaticTax: process.env.STRIPE_AUTOMATIC_TAX === "true",
  });
}
