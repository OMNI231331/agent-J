import { NextResponse } from "next/server";
import { getStripe } from "@/lib/checkout/stripe";
import { processWebhook } from "@/lib/checkout/webhook";
import { getStore } from "@/lib/inventory";

export const runtime = "nodejs";

// Stripe calls this for every payment event. The signature is verified against the RAW body, so do not parse it first.
export async function POST(req: Request) {
  const store = getStore();
  const stripe = getStripe();
  if (!store || !stripe) return NextResponse.json({ error: "Not configured." }, { status: 503 }); // Stripe retries on 5xx
  const raw = await req.text();
  const result = await processWebhook({ raw, signature: req.headers.get("stripe-signature"), secret: process.env.STRIPE_WEBHOOK_SECRET, store, stripe });
  return NextResponse.json(result.body, { status: result.status });
}
