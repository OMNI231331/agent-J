import type { Metadata } from "next";
import Link from "next/link";
import { ReleaseReservation } from "./release";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

export default async function CancelledPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  return (
    <div className="container-lsw py-24 text-center">
      {r && <ReleaseReservation reservationId={r} />}
      <p className="eyebrow">Checkout cancelled</p>
      <h1 className="display mt-4 text-5xl sm:text-7xl">No charge made.</h1>
      <p className="mx-auto mt-6 max-w-md text-silver">Your bag is saved. The pieces you were checking out have been released so others can buy them — check out again whenever you&apos;re ready.</p>
      <Link className="btn mt-10" href="/shop">Back to the shop</Link>
    </div>
  );
}
