import * as S from "./scripts";

/** The only thing the store needs from Redis. Implemented for Upstash (production) and ioredis (tests). */
export type RedisLike = {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
};

export type ReservationItem = {
  /** Redis key holding this variant's stock. */
  k: string;
  slug: string;
  colorId: string;
  size: string;
  qty: number;
  /** Unit price in cents, taken from the catalog on the server. */
  unitAmount: number;
  name: string;
};

export type ReservationState = "held" | "paid" | "released" | "refund_pending";

export type Reservation = {
  id: string;
  state: ReservationState;
  items: ReservationItem[];
  expiresAt: number;
  subtotal: number;
  sessionId?: string;
  releasedReason?: string;
};

export type OrderRecord = {
  id: string;
  sessionId: string;
  paymentIntent: string | null;
  status: "paid" | "needs_review" | "refund_pending";
  note?: string;
  email: string | null;
  name: string | null;
  shipping: unknown;
  amountTotal: number | null;
  amountSubtotal: number | null;
  currency: string | null;
  items: Pick<ReservationItem, "slug" | "colorId" | "size" | "qty" | "unitAmount" | "name">[];
  createdAt: string;
  lateRecovered?: boolean;
};

export type ReserveResult = { ok: true } | { ok: false; reason: "exists" } | { ok: false; reason: "insufficient"; variants: string[] };
export type CommitResult = "committed" | "duplicate" | "released" | "refund_pending" | "unknown";
export type ReacquireResult = "recovered" | "insufficient" | "paid" | "held" | "refund_pending" | "released" | "unknown";
export type ReleaseResult = "released_now" | "released" | "paid" | "refund_pending" | "unknown";

export const stockKeyFor = (prefix: string, slug: string, colorId: string, size: string) => `${prefix}stock:${slug}:${colorId}:${size}`;

export class InventoryStore {
  constructor(
    private readonly redis: RedisLike,
    readonly prefix = "lsw:",
  ) {}

  private key = {
    res: (id: string) => `${this.prefix}res:${id}`,
    expiry: () => `${this.prefix}res:expiry`,
    order: (id: string) => `${this.prefix}order:${id}`,
    orders: () => `${this.prefix}orders`,
    event: (id: string) => `${this.prefix}evt:${id}`,
  };

  stockKey(slug: string, colorId: string, size: string) {
    return stockKeyFor(this.prefix, slug, colorId, size);
  }

  // ---- stock ----
  async getStock(keys: string[]): Promise<(number | null)[]> {
    if (keys.length === 0) return [];
    const raw = (await this.redis.eval(S.MGET, keys, [])) as (string | null)[];
    return raw.map((v) => (v === null || v === undefined || v === "" ? null : Number(v)));
  }

  async setStock(key: string, qty: number): Promise<number> {
    return Number(await this.redis.eval(S.SET_STOCK, [key], [qty]));
  }

  /** Adds (or subtracts) units. Returns the new total, or null if it would go below zero. */
  async adjustStock(key: string, delta: number): Promise<number | null> {
    const n = Number(await this.redis.eval(S.ADJUST_STOCK, [key], [delta]));
    return n < 0 ? null : n;
  }

  // ---- reservations ----
  /** Atomically takes stock for every item, or for none of them. Items must be distinct variants. */
  async reserve(args: { id: string; items: ReservationItem[]; expiresAt: number; now?: number }): Promise<ReserveResult> {
    const { id, items, expiresAt } = args;
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitAmount, 0);
    const res = (await this.redis.eval(
      S.RESERVE,
      [this.key.res(id), this.key.expiry(), ...items.map((i) => i.k)],
      [id, expiresAt, JSON.stringify(items), subtotal, args.now ?? Date.now()],
    )) as (string | number)[];
    if (res[0] === "ok") return { ok: true };
    if (res[0] === "exists") return { ok: false, reason: "exists" };
    return { ok: false, reason: "insufficient", variants: res.slice(1).map((n) => items[Number(n) - 1].k) };
  }

  async attachSession(id: string, sessionId: string) {
    await this.redis.eval(S.ATTACH_SESSION, [this.key.res(id)], [sessionId]);
  }

  async getReservation(id: string): Promise<Reservation | null> {
    const flat = (await this.redis.eval(S.GET_HASH, [this.key.res(id)], [])) as string[];
    if (!flat || flat.length === 0) return null;
    const h: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) h[flat[i]] = flat[i + 1];
    return {
      id,
      state: h.state as ReservationState,
      items: JSON.parse(h.items) as ReservationItem[],
      expiresAt: Number(h.expiresAt),
      subtotal: Number(h.subtotal),
      sessionId: h.sessionId,
      releasedReason: h.releasedReason,
    };
  }

  async commit(id: string, order: OrderRecord, now = Date.now()): Promise<CommitResult> {
    return (await this.redis.eval(
      S.COMMIT,
      [this.key.res(id), this.key.expiry(), this.key.order(id), this.key.orders()],
      [id, now, JSON.stringify(order)],
    )) as CommitResult;
  }

  async release(id: string, reason: string, now = Date.now()): Promise<ReleaseResult> {
    return (await this.redis.eval(S.RELEASE, [this.key.res(id), this.key.expiry()], [id, reason, now])) as ReleaseResult;
  }

  /** Releases holds whose expiry has passed. Safe to run often and from several places at once. */
  async sweepExpired(now = Date.now(), limit = 100): Promise<string[]> {
    return (await this.redis.eval(S.SWEEP, [this.key.expiry()], [now, limit, this.key.res("")])) as string[];
  }

  async reacquire(id: string, order: OrderRecord, now = Date.now()): Promise<ReacquireResult> {
    return (await this.redis.eval(
      S.REACQUIRE,
      [this.key.res(id), this.key.expiry(), this.key.order(id), this.key.orders()],
      [id, now, JSON.stringify(order)],
    )) as ReacquireResult;
  }

  async markRefundPending(id: string, order: OrderRecord, now = Date.now()) {
    return (await this.redis.eval(S.MARK_REFUND, [this.key.res(id), this.key.order(id), this.key.orders()], [JSON.stringify(order), now, id])) as string;
  }

  // ---- orders ----
  async listOrders(limit = 50): Promise<OrderRecord[]> {
    const raw = (await this.redis.eval(S.LIST_ORDERS, [this.key.orders()], [limit, this.key.order("")])) as string[];
    return raw.map((s) => JSON.parse(s) as OrderRecord);
  }

  // ---- webhook idempotency ----
  async claimEvent(eventId: string): Promise<"claimed" | "processing" | "done"> {
    return (await this.redis.eval(S.CLAIM_EVENT, [this.key.event(eventId)], [300])) as "claimed" | "processing" | "done";
  }
  async finishEvent(eventId: string) {
    await this.redis.eval(S.FINISH_EVENT, [this.key.event(eventId)], [60 * 60 * 24 * 7]);
  }
  async unclaimEvent(eventId: string) {
    await this.redis.eval(S.UNCLAIM_EVENT, [this.key.event(eventId)], []);
  }

  // ---- abuse protection ----
  /** Counts a hit and returns how many hits this key has had in the current window. */
  async hit(bucket: string, windowSeconds: number): Promise<number> {
    return Number(await this.redis.eval(S.RATE_LIMIT, [`${this.prefix}rl:${bucket}`], [windowSeconds]));
  }
}
