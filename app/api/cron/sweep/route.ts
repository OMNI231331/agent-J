import { NextResponse } from "next/server";
import { getStore } from "@/lib/inventory";

export const runtime = "nodejs";

// Backstop for abandoned checkouts: returns stock from holds that expired without Stripe telling us.
// Vercel Cron calls this with  Authorization: Bearer <CRON_SECRET>  when CRON_SECRET is set in the project.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Redis isn't configured." }, { status: 503 });
  const released = await store.sweepExpired();
  return NextResponse.json({ released: released.length });
}
