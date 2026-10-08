import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "./clear-cart";

export const metadata: Metadata = { title: "Order received", robots: { index: false } };

export default function SuccessPage() {
  return (
    <div className="container-lsw py-24 text-center">
      <ClearCart />
      <p className="eyebrow">Order received</p>
      <h1 className="display mt-4 text-5xl sm:text-7xl">Thank you.</h1>
      <p className="mx-auto mt-6 max-w-md text-silver">Your payment was submitted. A receipt will be emailed by our payment provider. Faith / Discipline / Purpose.</p>
      <Link className="btn mt-10" href="/shop">Continue shopping</Link>
    </div>
  );
}
