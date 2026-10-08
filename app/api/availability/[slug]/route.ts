import { NextResponse } from "next/server";
import { getProduct, variantKey } from "@/lib/lsw";
import { getStore } from "@/lib/inventory";

export const runtime = "nodejs";

// Public. Says only whether each variant can be bought, never how many are left.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const store = getStore();
  if (!store) return NextResponse.json({ configured: false, variants: {} });

  const combos = product.colors.flatMap((c) => product.sizes.map((s) => ({ key: variantKey(c.id, s), redis: store.stockKey(slug, c.id, s) })));
  const stock = await store.getStock(combos.map((c) => c.redis));
  const variants: Record<string, boolean> = {};
  combos.forEach((c, i) => (variants[c.key] = (stock[i] ?? 0) > 0));
  return NextResponse.json({ configured: true, variants }, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } });
}
