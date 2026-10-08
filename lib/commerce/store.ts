import * as S from "./scripts.ts";

/** The only Redis capability the commerce layer needs. Upstash in production, a local client in tests. */
export interface RedisLike {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export type Line = { sku: string; qty: number };
export type ReservationStatus = "reserved" | "awaiting_payment" | "committed" | "committed_oversold" | "released";
export type Reservation = { id: string; status: ReservationStatus; lines: Line[]; expiresAt: number; sessionId?: string; reason?: string; subtotalCents?: number };
export type OrderStatus = "awaiting_payment" | "paid" | "payment_failed" | "needs_attention" | "refunded";
export type Order = { sessionId: string; status: OrderStatus; createdAt: number; updatedAt: number; details: OrderDetails };
export type OrderDetails = {
  reservationId: string;
  lines: Line[];
  amountTotal: number | null;
  currency: string | null;
  email: string | null;
  paymentIntent?: string | null;
  note?: string;
};

const P = "lsw:";
export const K = {
  inv: (sku: string) => `${P}inv:${sku}`,
  res: (id: string) => `${P}res:${id}`,
  expiryIndex: `${P}res:expiry`,
  order: (sessionId: string) => `${P}order:${sessionId}`,
  orderIndex: `${P}orders`,
  event: (id: string) => `${P}evt:${id}`,
  rate: (bucket: string) => `${P}rate:${bucket}`,
};

/** Terminal reservations and processed-event markers are kept 30 days for audit and duplicate detection. */
export const RETENTION_SEC = 60 * 60 * 24 * 30;
const ORDER_RANK: Record<OrderStatus, number> = { awaiting_payment: 1, paid: 2, payment_failed: 2, needs_attention: 3, refunded: 4 };

/** Canonical encoding: merged, sorted by SKU, so the same cart always produces the same string. */
export function normalizeLines(lines: Line[]): Line[] {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
  return [...merged].sort(([a], [b]) => (a < b ? -1 : 1)).map(([sku, qty]) => ({ sku, qty }));
}
export const encodeLines = (lines: Line[]) => normalizeLines(lines).map((l) => `${l.sku}:${l.qty}`).join("|");
export const decodeLines = (s: string): Line[] =>
  s.split("|").filter(Boolean).map((p) => {
    const i = p.lastIndexOf(":");
    return { sku: p.slice(0, i), qty: Number(p.slice(i + 1)) };
  });

const pairsToObject = (arr: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (Array.isArray(arr)) for (let i = 0; i + 1 < arr.length; i += 2) out[String(arr[i])] = String(arr[i + 1]);
  return out;
};

export type ReserveResult = { ok: true } | { ok: false; reason: "duplicate" } | { ok: false; reason: "insufficient"; sku: string; available: number | null };

export class InventoryStore {
  private readonly r: RedisLike;
  constructor(redis: RedisLike) {
    this.r = redis;
  }

  async getStock(skus: string[]): Promise<Record<string, number | null>> {
    if (!skus.length) return {};
    const vals = (await this.r.eval(S.MGET, skus.map(K.inv), [])) as (string | null)[];
    return Object.fromEntries(skus.map((sku, i) => [sku, vals?.[i] == null ? null : Number(vals[i])]));
  }

  /** Absolute stock counts. Admin/seed use only. */
  async setStock(counts: Record<string, number>): Promise<void> {
    const skus = Object.keys(counts);
    if (!skus.length) return;
    await this.r.eval(S.SET_STOCK, skus.map(K.inv), skus.map((s) => String(counts[s])));
  }

  /** Relative change (restock +N, correction -N). Refuses to go below zero; returns the new count or null if refused. */
  async adjustStock(sku: string, delta: number): Promise<number | null> {
    const n = Number(await this.r.eval(S.ADJUST, [K.inv(sku)], [String(delta)]));
    return n < 0 ? null : n;
  }

  /** All-or-nothing: either every line is reserved or nothing changes. */
  async reserve(id: string, lines: Line[], expiresAt: number): Promise<ReserveResult> {
    const norm = normalizeLines(lines);
    const res = (await this.r.eval(
      S.RESERVE,
      [K.res(id), K.expiryIndex, ...norm.map((l) => K.inv(l.sku))],
      [id, String(expiresAt), encodeLines(norm), ...norm.map((l) => String(l.qty))],
    )) as number[];
    if (Number(res[0]) === 1) return { ok: true };
    if (Number(res[0]) === -1) return { ok: false, reason: "duplicate" };
    const idx = Number(res[1]) - 1;
    const avail = Number(res[2]);
    return { ok: false, reason: "insufficient", sku: norm[idx].sku, available: avail < 0 ? null : avail };
  }

  async getReservation(id: string): Promise<Reservation | null> {
    const h = pairsToObject(await this.r.eval(S.HGETALL, [K.res(id)], []));
    if (!h.status) return null;
    return {
      id,
      status: h.status as ReservationStatus,
      lines: decodeLines(h.lines ?? ""),
      expiresAt: Number(h.expiresAt),
      sessionId: h.sessionId || undefined,
      reason: h.reason || undefined,
      subtotalCents: h.subtotalCents ? Number(h.subtotalCents) : undefined,
    };
  }

  /** Links the Stripe session and records the subtotal we reserved at catalog prices, so the webhook can check what Stripe charged. */
  async attachSession(id: string, sessionId: string, subtotalCents: number): Promise<void> {
    await this.r.eval(S.HSET, [K.res(id)], ["sessionId", sessionId, "subtotalCents", String(subtotalCents)]);
  }

  private async withLines(script: string, id: string, args: (lines: string) => string[]): Promise<string> {
    const r = await this.getReservation(id);
    if (!r) return "missing";
    const lines = encodeLines(r.lines);
    return String(await this.r.eval(script, [K.res(id), K.expiryIndex, ...r.lines.map((l) => K.inv(l.sku))], [...args(lines), ...r.lines.map((l) => String(l.qty))]));
  }

  /** Returns stock to inventory. Safe to call repeatedly; only the first call has an effect. */
  release(id: string, reason: string): Promise<string> {
    return this.withLines(S.RELEASE, id, (lines) => [id, lines, reason, String(RETENTION_SEC)]);
  }

  /** Makes a reservation permanent after payment. Safe to call repeatedly. */
  commit(id: string): Promise<string> {
    return this.withLines(S.COMMIT, id, (lines) => [id, lines, String(RETENTION_SEC)]);
  }

  async markAwaitingPayment(id: string): Promise<string> {
    return String(await this.r.eval(S.MARK_AWAITING, [K.res(id), K.expiryIndex], [id]));
  }

  /** Releases reservations whose hold has run out (abandoned checkouts the expired-webhook missed). */
  async sweepExpired(now: number, limit = 50): Promise<number> {
    const due = (await this.r.eval(S.DUE, [K.expiryIndex], [String(now), String(limit)])) as string[];
    let n = 0;
    for (const id of due ?? []) {
      const out = await this.release(id, "expired_sweep");
      if (out === "released") n++;
      else await this.r.eval(S.ZREM, [K.expiryIndex], [id]); // dangling/terminal entry: drop it so it isn't retried forever
    }
    return n;
  }

  /** Returns false if the order already has a higher-precedence status (out-of-order or duplicate events). */
  async upsertOrder(sessionId: string, status: OrderStatus, details: OrderDetails, now: number): Promise<boolean> {
    const r = await this.r.eval(S.ORDER_UPSERT, [K.order(sessionId), K.orderIndex], [sessionId, status, String(ORDER_RANK[status]), String(now), JSON.stringify(details)]);
    return Number(r) === 1;
  }

  async getOrder(sessionId: string): Promise<Order | null> {
    const h = pairsToObject(await this.r.eval(S.HGETALL, [K.order(sessionId)], []));
    if (!h.status) return null;
    return { sessionId, status: h.status as OrderStatus, createdAt: Number(h.createdAt), updatedAt: Number(h.updatedAt), details: JSON.parse(h.details) };
  }

  async recentOrders(limit = 20): Promise<Order[]> {
    const ids = ((await this.r.eval(S.RECENT_ORDERS, [K.orderIndex], [String(limit)])) as string[]) ?? [];
    const orders = await Promise.all(ids.map((id) => this.getOrder(id)));
    return orders.filter((o): o is Order => o !== null);
  }

  /** Fixed-window limiter. Returns true while the caller is within `limit` hits per `windowSec`. */
  async allow(bucket: string, limit: number, windowSec: number): Promise<boolean> {
    return Number(await this.r.eval(S.RATE_HIT, [K.rate(bucket)], [String(windowSec)])) <= limit;
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return (await this.r.eval(S.GET, [K.event(eventId)], [])) != null;
  }
  async markEventProcessed(eventId: string): Promise<boolean> {
    return Number(await this.r.eval(S.SET_NX_EX, [K.event(eventId)], ["1", String(RETENTION_SEC)])) === 1;
  }
}
