import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "@/components/lsw/clear-cart";
import { Page } from "@/components/lsw/prose";

export const metadata: Metadata = { title: "Order received" };

export default function SuccessPage() {
  return (
    <Page eyebrow="Order" title="Thank you">
      <ClearCart />
      <p>Your payment went through and your order is being prepared. A receipt comes from the payment provider by email when receipts are enabled on the store account.</p>
      <Link className="inline-block border-b border-neutral-400 pb-0.5" href="/shop">
        Keep browsing
      </Link>
    </Page>
  );
}
