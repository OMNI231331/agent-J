import { NextResponse } from "next/server";
import { findSku, MAX_PER_LINE, variantAvailability } from "@/lib/inventory";
import { INVENTORY_SOURCE } from "@/lib/catalog";

export const runtime = "nodejs";

type Body = { lines?: { sku?: unknown; qty?: unknown }[] };

/**
 * Creates a Stripe Checkout Session. Prices and availability are ALWAYS re-derived
 * server-side from the catalog; the client only sends SKU + quantity.
 * Needs STRIPE_SECRET_KEY (sk_test_… = test mode, sk_live_… = real payments).
 */
export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Checkout isn't connected yet. The store owner needs to configure Stripe (see docs/LAUNCH.md)." },
      { status: 503 },
    );
  }
  if (key.startsWith("sk_live_") && INVENTORY_SOURCE === "demo") {
    return NextResponse.json({ error: "Live payments are blocked while inventory is demo data." }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 20) {
    return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  params.set("success_url", `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/shop`);
  params.set("shipping_address_collection[allowed_countries][0]", "US");
  if (process.env.STRIPE_SHIPPING_RATE_ID) params.set("shipping_options[0][shipping_rate]", process.env.STRIPE_SHIPPING_RATE_ID);
  if (process.env.STRIPE_AUTOMATIC_TAX === "true") params.set("automatic_tax[enabled]", "true");

  const problems: string[] = [];
  body.lines.forEach((l, i) => {
    const sku = typeof l.sku === "string" ? l.sku : "";
    const qty = Number(l.qty);
    const hit = findSku(sku);
    if (!hit || !Number.isInteger(qty) || qty < 1 || qty > MAX_PER_LINE) {
      problems.push(`Invalid item in bag.`);
      return;
    }
    const { product, variant } = hit;
    if (variantAvailability(product, variant) !== "in_stock" || qty > (variant.stock ?? 0)) {
      problems.push(`${product.name} (${variant.size}) is no longer available in that quantity.`);
      return;
    }
    params.set(`line_items[${i}][quantity]`, String(qty));
    params.set(`line_items[${i}][price_data][currency]`, "usd");
    params.set(`line_items[${i}][price_data][unit_amount]`, String(product.priceCents));
    params.set(`line_items[${i}][price_data][product_data][name]`, product.name);
    params.set(`line_items[${i}][price_data][product_data][description]`, `${variant.color.replace("-", " ")} / ${variant.size}`);
    params.set(`line_items[${i}][price_data][product_data][metadata][sku]`, sku);
  });
  if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 409 });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.url) {
    console.error("Stripe checkout error", data?.error?.message);
    return NextResponse.json({ error: "We couldn't start checkout. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ url: data.url });
}
