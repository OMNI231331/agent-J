import { NextResponse } from "next/server";
import { cancelCheckout } from "@/lib/commerce/checkout";
import { commerceConfig } from "@/lib/commerce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Called by /checkout/cancelled. The reservation id is an unguessable UUID from our own cancel_url. */
export async function POST(req: Request) {
  const cfg = commerceConfig();
  if (!cfg.ok) return NextResponse.json({ ok: false }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { reservationId?: unknown } | null;
  const id = typeof body?.reservationId === "string" ? body.reservationId : "";
  if (!UUID.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const outcome = await cancelCheckout(id, cfg);
    return NextResponse.json({ ok: true, outcome });
  } catch (e) {
    console.error("cancel: failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
