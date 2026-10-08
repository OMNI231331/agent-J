"use client";
import { useEffect } from "react";

/** Fire-and-forget: expires the Stripe session and returns the held stock. Safe to repeat. */
export function ReleaseReservation({ reservationId }: { reservationId: string }) {
  useEffect(() => {
    fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId }),
      keepalive: true,
    }).catch(() => undefined);
  }, [reservationId]);
  return null;
}
