import { NextResponse } from "next/server";
import { clientIdFromRequest, createCheckout } from "@/lib/checkout/create";
import { getSiteUrl, getStripe, keyProblem } from "@/lib/checkout/stripe";
import { getStore } from "@/lib/inventory";

export const runtime = "nodejs";

// Starts a Stripe Checkout Session after reserving stock. Everything is validated against lib/lsw.ts on the server.
export async function POST(req: Request) {
  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const store = getStore();
  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  if (!store || !stripe || !siteUrl) {
    // Shoppers get a plain message. The technical reason goes to the server log for the owner.
    console.error("[checkout] not available:", keyProblem(process.env.STRIPE_SECRET_KEY) ?? (!store ? "Redis is not configured." : "SITE_URL is not set."));
    return NextResponse.json({ error: "Checkout isn't open yet. Join early access to hear when it is." }, { status: 503 });
  }

  const result = await createCheckout({ items: body.items, clientId: clientIdFromRequest(req) }, { store, stripe, siteUrl });
  return NextResponse.json(result.body, { status: result.status });
}
