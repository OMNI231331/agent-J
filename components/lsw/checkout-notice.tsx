"use client";

import { useEffect, useState } from "react";

/** Shown after the customer backs out of Stripe's page. Their stock hold has already been released. */
export function CheckoutNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "canceled") setShow(true);
  }, []);
  if (!show) return null;
  return (
    <p className="mb-8 border border-white/20 bg-white/5 p-4 text-sm text-neutral-300" role="status">
      Checkout canceled. Nothing was charged and your items are still in your bag.
    </p>
  );
}
