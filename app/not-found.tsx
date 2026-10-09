import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/store-shell";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <StoreShell>
      <div className="container-lsw py-24 text-center sm:py-32">
        <p className="eyebrow">404</p>
        <h1 className="display mt-4 text-5xl sm:text-7xl">Page not found</h1>
        <p className="mx-auto mt-6 max-w-md text-silver">That page doesn&apos;t exist or has moved.</p>
        <Link className="btn mt-10" href="/shop">Back to the shop</Link>
      </div>
    </StoreShell>
  );
}
