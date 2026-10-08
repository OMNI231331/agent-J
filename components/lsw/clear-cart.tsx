"use client";

import { useEffect } from "react";
import { useCart } from "./cart-provider";

/** Empties the bag once, after a successful checkout. */
export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => clear(), [clear]);
  return null;
}
