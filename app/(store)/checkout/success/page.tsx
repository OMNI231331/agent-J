import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/commerce/redis";
import type { OrderStatus } from "@/lib/commerce/store";
import { ClearCart } from "./clear-cart";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

const COPY: Record<OrderStatus | "pending", { eyebrow: string; title: string; body: string }> = {
  paid: { eyebrow: "Order confirmed", title: "Thank you.", body: "Your payment is confirmed and your pieces are reserved. A receipt has been emailed by our payment provider." },
  awaiting_payment: { eyebrow: "Payment processing", title: "Almost there.", body: "Your payment method takes a little longer to confirm. Your pieces are held, and you'll get an email once it clears." },
  payment_failed: { eyebrow: "Payment failed", title: "Payment didn't go through.", body: "You haven't been charged and your pieces were released. You can try again from the shop." },
  refunded: { eyebrow: "Order refunded", title: "Sorry — it sold out.", body: "Your payment arrived just after the last piece was taken, so we refunded it in full. The refund can take a few days to show on your statement." },
  needs_attention: { eyebrow: "We're on it", title: "Thank you.", body: "Your payment was received, but we need to confirm stock for your order. We'll contact you by email — you will not be charged for anything we can't ship." },
  pending: { eyebrow: "Order received", title: "Thank you.", body: "We're confirming your payment. This page updates on refresh; a receipt is emailed by our payment provider." },
};

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const store = getStore();
  const order = session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id) && store ? await store.getOrder(session_id).catch(() => null) : null;
  const c = COPY[order?.status ?? "pending"];
  return (
    <div className="container-lsw py-24 text-center">
      {order?.status !== "payment_failed" && <ClearCart />}
      <p className="eyebrow">{c.eyebrow}</p>
      <h1 className="display mt-4 text-5xl sm:text-7xl">{c.title}</h1>
      <p className="mx-auto mt-6 max-w-md text-silver">{c.body}</p>
      <Link className="btn mt-10" href="/shop">Continue shopping</Link>
    </div>
  );
}
