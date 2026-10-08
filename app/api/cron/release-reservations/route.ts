import { NextResponse } from "next/server";
import { getStore } from "@/lib/commerce/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safety net for abandoned checkouts: returns stock from reservations whose hold expired.
 * The primary path is Stripe's checkout.session.expired webhook; checkout also sweeps before reserving.
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "not configured" }, { status: 503 });
  let released = 0;
  for (let i = 0; i < 10; i++) {
    const n = await store.sweepExpired(Date.now());
    released += n;
    if (n === 0) break;
  }
  return NextResponse.json({ released });
}
