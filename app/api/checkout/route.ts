import { NextResponse } from "next/server";
import { startCheckout } from "@/lib/commerce/checkout";
import { clientIp } from "@/lib/commerce/client-ip";
import { commerceConfig } from "@/lib/commerce/config";
import { validateCart } from "@/lib/commerce/validate";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reserves stock atomically in Redis, then creates a Stripe Checkout Session. The client sends only SKU + qty (+ displayed price). */
export async function POST(req: Request) {
  const cfg = commerceConfig();
  if (!cfg.ok) return NextResponse.json({ error: cfg.error }, { status: 503 });
  // A live store must know its own public address (used for Stripe's return links); never trust the request's Host for money flows.
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (site.mode === "live" && !configuredOrigin) {
    return NextResponse.json({ error: "Checkout isn't ready yet: the site address isn't configured." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Malformed or impossible carts are rejected for free; only real checkout attempts count toward the limit.
  const checked = validateCart(body.lines, { liveMode: site.mode === "live" });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });

  try {
    // Stops scripts from reserving (hoarding) a limited drop: max 8 checkout starts per IP per 10 minutes.
    if (!(await cfg.store.allow(`checkout:${clientIp(req.headers)}`, 8, 600)))
      return NextResponse.json({ error: "Too many checkout attempts. Please wait a few minutes and try again." }, { status: 429 });
    const result = await startCheckout(body.lines, {
      store: cfg.store,
      stripe: cfg.stripe,
      origin: configuredOrigin ?? new URL(req.url).origin,
      liveMode: site.mode === "live",
      shippingRateId: process.env.STRIPE_SHIPPING_RATE_ID || undefined,
      automaticTax: process.env.STRIPE_AUTOMATIC_TAX === "true",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error("checkout: unexpected error", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't start checkout. Please try again in a moment." }, { status: 503 });
  }
}
