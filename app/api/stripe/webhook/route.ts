import { NextResponse } from "next/server";
import { getStore } from "@/lib/commerce/redis";
import { verifyStripeSignature } from "@/lib/commerce/stripe";
import { handleStripeEvent, type StripeEvent } from "@/lib/commerce/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe → LSW. The raw body is verified against STRIPE_WEBHOOK_SECRET before anything is parsed.
 * 400 = bad signature (Stripe won't retry usefully); 500 = our infrastructure failed (Stripe retries).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const store = getStore();
  if (!secret || !store) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event, store);
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    console.error("webhook: processing failed", event.id, event.type, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
