import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { getProduct, isVariantAvailable } from "@/lib/lsw";
import type { InventoryStore, ReservationItem } from "@/lib/inventory/store";
import type { StripeLike } from "./stripe";

export const MAX_QTY_PER_LINE = 10;
export const MAX_UNITS_PER_ORDER = 10;
export const SESSION_MINUTES = 31; // Stripe requires a Checkout Session to live at least 30 minutes
export const HOLD_GRACE_MINUTES = 5; // we keep stock held a little past the session so only truly abandoned holds get swept
export const RATE_LIMIT_MAX = 8;
export const RATE_LIMIT_WINDOW_SECONDS = 600;

export type Deps = {
  store: InventoryStore;
  stripe: StripeLike;
  siteUrl: string;
  now?: () => number;
  newId?: () => string;
};

export type Result = { status: number; body: Record<string, unknown> };

type Line = { slug: string; colorId: string; size: string; qty: number };

/** Checks every field against the catalog. Prices are never read from the request. */
export function validateCart(input: unknown): { ok: true; lines: Line[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return { ok: false, error: "Your bag is empty." };
  const merged = new Map<string, Line>();
  for (const raw of input) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const p = typeof r.slug === "string" ? getProduct(r.slug) : undefined;
    const color = p?.colors.find((c) => c.id === r.colorId);
    const qty = r.qty;
    if (!p || !color || typeof r.size !== "string" || !p.sizes.includes(r.size) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { ok: false, error: "One of the items in your bag is invalid." };
    }
    if (!isVariantAvailable(p, color.id, r.size)) return { ok: false, error: `${p.name} (${color.name}, ${r.size}) is unavailable.` };
    const key = `${p.slug}|${color.id}|${r.size}`;
    const prev = merged.get(key);
    merged.set(key, { slug: p.slug, colorId: color.id, size: r.size, qty: (prev?.qty ?? 0) + qty });
  }
  const lines = [...merged.values()];
  if (lines.some((l) => l.qty > MAX_QTY_PER_LINE) || lines.reduce((s, l) => s + l.qty, 0) > MAX_UNITS_PER_ORDER) {
    return { ok: false, error: `Orders are limited to ${MAX_UNITS_PER_ORDER} items.` };
  }
  return { ok: true, lines };
}

export function clientIdFromRequest(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function createCheckout(input: { items: unknown; clientId: string }, deps: Deps): Promise<Result> {
  const { store, stripe, siteUrl } = deps;
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => `res_${randomUUID()}`);

  const checked = validateCart(input.items);
  if (!checked.ok) return { status: 400, body: { error: checked.error } };

  // Return any expired holds to stock before checking availability. Best effort: failing here never blocks a sale.
  await store.sweepExpired(now()).catch(() => []);

  if ((await store.hit(`checkout:${input.clientId}`, RATE_LIMIT_WINDOW_SECONDS)) > RATE_LIMIT_MAX) {
    return { status: 429, body: { error: "Too many checkout attempts. Please wait a few minutes." } };
  }

  const items: ReservationItem[] = checked.lines.map((l) => {
    const p = getProduct(l.slug)!;
    const color = p.colors.find((c) => c.id === l.colorId)!;
    return {
      k: store.stockKey(l.slug, l.colorId, l.size),
      slug: l.slug,
      colorId: l.colorId,
      size: l.size,
      qty: l.qty,
      unitAmount: Math.round(p.price * 100),
      name: `${p.name} (${color.name} / ${l.size})`,
    };
  });

  const reservationId = newId();
  const sessionExpiresAt = Math.floor(now() / 1000) + SESSION_MINUTES * 60;
  const reserved = await store.reserve({
    id: reservationId,
    items,
    expiresAt: (sessionExpiresAt + HOLD_GRACE_MINUTES * 60) * 1000,
    now: now(),
  });
  if (!reserved.ok) {
    if (reserved.reason === "insufficient") {
      const names = items.filter((i) => reserved.variants.includes(i.k)).map((i) => i.name);
      return { status: 409, body: { error: `Sold out or not enough left: ${names.join(", ")}.`, soldOut: names } };
    }
    return { status: 500, body: { error: "Couldn't start checkout. Please try again." } };
  }

  let session: { id: string; url: string | null };
  try {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      client_reference_id: reservationId,
      metadata: { reservationId },
      payment_intent_data: { metadata: { reservationId } },
      expires_at: sessionExpiresAt,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/api/checkout/cancel?r=${reservationId}`,
      shipping_address_collection: {
        allowed_countries: (process.env.STRIPE_ALLOWED_COUNTRIES ?? "US").split(",").map((c) => c.trim()) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
      },
      line_items: items.map((i) => ({
        quantity: i.qty,
        price_data: { currency: "usd", unit_amount: i.unitAmount, product_data: { name: i.name, metadata: { slug: i.slug, color: i.colorId, size: i.size } } },
      })),
    };
    session = await stripe.checkout.sessions.create(params, { idempotencyKey: reservationId });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
  } catch (err) {
    console.error("[checkout] stripe session failed", err instanceof Error ? err.message : err);
    await store.release(reservationId, "stripe_error", now());
    return { status: 502, body: { error: "We couldn't start checkout. Please try again." } };
  }

  await store.attachSession(reservationId, session.id);
  return { status: 200, body: { url: session.url } };
}

/** Customer pressed "back" on Stripe's page. Expire the session first so it can't be paid, then free the stock. */
export async function cancelReservation(reservationId: string, deps: Pick<Deps, "store" | "stripe" | "now">): Promise<"released" | "left_to_webhook" | "nothing"> {
  const { store, stripe } = deps;
  const now = deps.now ?? Date.now;
  const res = await store.getReservation(reservationId);
  if (!res || res.state !== "held") return "nothing";
  if (res.sessionId) {
    try {
      await stripe.checkout.sessions.expire(res.sessionId);
    } catch {
      // Already paid or already expired. The webhook for that event decides what happens to the stock.
      return "left_to_webhook";
    }
  }
  await store.release(reservationId, "canceled", now());
  return "released";
}
