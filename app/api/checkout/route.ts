import { NextResponse } from "next/server";
import { startCheckout } from "@/lib/commerce/checkout";
import { commerceConfig } from "@/lib/commerce/config";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reserves stock atomically in Redis, then creates a Stripe Checkout Session. The client sends only SKU + qty (+ displayed price). */
export async function POST(req: Request) {
  const cfg = commerceConfig();
  if (!cfg.ok) return NextResponse.json({ error: cfg.error }, { status: 503 });
  // Stops scripts from reserving (hoarding) a limited drop: max 8 checkout starts per IP per 10 minutes.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await cfg.store.allow(`checkout:${ip}`, 8, 600)))
    return NextResponse.json({ error: "Too many checkout attempts. Please wait a few minutes and try again." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const result = await startCheckout(body.lines, {
      store: cfg.store,
      stripe: cfg.stripe,
      origin: process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin,
      liveMode: site.mode === "live",
      shippingRateId: process.env.STRIPE_SHIPPING_RATE_ID || undefined,
      automaticTax: process.env.STRIPE_AUTOMATIC_TAX === "true",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error("checkout: unexpected error", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't start checkout. Please try again." }, { status: 500 });
  }
}
