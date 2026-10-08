import { site } from "../site.ts";
import { stripeClient, stripeMode, type StripeApi } from "./stripe.ts";
import { getStore } from "./redis.ts";
import type { InventoryStore } from "./store.ts";

export type CommerceConfig =
  | { ok: true; store: InventoryStore; stripe: StripeApi; mode: "test" | "live" }
  | { ok: false; error: string };

/**
 * Single gate for anything that takes money. Live keys are refused unless the owner has
 * explicitly opted in with ALLOW_LIVE_PAYMENTS=true AND the site is in live mode.
 */
export function commerceConfig(): CommerceConfig {
  const key = process.env.STRIPE_SECRET_KEY;
  const mode = stripeMode(key);
  if (!key || mode === "invalid") return { ok: false, error: "Checkout isn't connected yet. The store owner needs to configure Stripe (see docs/CHECKOUT.md)." };
  if (mode === "live" && (process.env.ALLOW_LIVE_PAYMENTS !== "true" || site.mode !== "live"))
    return { ok: false, error: "Live payments are not enabled for this store yet." };
  const store = getStore();
  if (!store) return { ok: false, error: "Inventory isn't connected yet. The store owner needs to configure Upstash Redis (see docs/CHECKOUT.md)." };
  return { ok: true, store, stripe: stripeClient(key), mode };
}
