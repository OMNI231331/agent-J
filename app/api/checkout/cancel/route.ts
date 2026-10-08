import { NextResponse } from "next/server";
import { cancelReservation } from "@/lib/checkout/create";
import { getSiteUrl, getStripe } from "@/lib/checkout/stripe";
import { getStore } from "@/lib/inventory";

export const runtime = "nodejs";

// Stripe sends customers here when they leave checkout. We free their held stock, then send them back to the shop.
export async function GET(req: Request) {
  const reservationId = new URL(req.url).searchParams.get("r");
  const store = getStore();
  const stripe = getStripe();
  if (reservationId && /^res_[0-9a-f-]{36}$/.test(reservationId) && store && stripe) {
    await cancelReservation(reservationId, { store, stripe }).catch((e) => console.error("[cancel]", e instanceof Error ? e.message : e));
  }
  return NextResponse.redirect(`${getSiteUrl() ?? new URL(req.url).origin}/shop?checkout=canceled`, 303);
}
