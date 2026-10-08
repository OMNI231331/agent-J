import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getProduct, products, variantKey } from "@/lib/lsw";
import { getStore } from "@/lib/inventory";

export const runtime = "nodejs";

// Owner-only stock control. Send:  Authorization: Bearer <ADMIN_TOKEN>
function authorized(req: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 24) return false; // refuse to run with a weak or missing token
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Redis isn't configured." }, { status: 503 });
  const rows = products.flatMap((p) => p.colors.flatMap((c) => p.sizes.map((s) => ({ slug: p.slug, colorId: c.id, size: s, key: store.stockKey(p.slug, c.id, s) }))));
  const stock = await store.getStock(rows.map((r) => r.key));
  const orders = await store.listOrders(50);
  return NextResponse.json({
    stock: rows.map((r, i) => ({ slug: r.slug, colorId: r.colorId, size: r.size, available: stock[i] ?? 0 })),
    orders,
  });
}

// Body: { slug, colorId, size, qty, mode: "set" | "add" }  or  { updates: [ ...same ] }
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Redis isn't configured." }, { status: 503 });
  let body: { updates?: unknown[] } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const updates = (Array.isArray(body.updates) ? body.updates : [body]) as Record<string, unknown>[];
  if (updates.length < 1 || updates.length > 100) return NextResponse.json({ error: "Send 1 to 100 updates." }, { status: 400 });

  const parsed = [];
  for (const u of updates) {
    const p = typeof u.slug === "string" ? getProduct(u.slug) : undefined;
    const color = p?.colors.find((c) => c.id === u.colorId);
    const qty = u.qty;
    const mode = u.mode === "add" ? "add" : u.mode === "set" ? "set" : null;
    if (!p || !color || typeof u.size !== "string" || !p.sizes.includes(u.size) || !mode || typeof qty !== "number" || !Number.isInteger(qty) || Math.abs(qty) > 100000 || (mode === "set" && qty < 0)) {
      return NextResponse.json({ error: "Each update needs a real slug, colorId and size, an integer qty, and mode set or add." }, { status: 400 });
    }
    parsed.push({ p, color, size: u.size, qty, mode, key: store.stockKey(p.slug, color.id, u.size) });
  }

  const results = [];
  for (const u of parsed) {
    const value = u.mode === "set" ? await store.setStock(u.key, u.qty) : await store.adjustStock(u.key, u.qty);
    results.push({ variant: `${u.p.slug}/${variantKey(u.color.id, u.size)}`, available: value, ok: value !== null });
  }
  return NextResponse.json({ results });
}
