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
export function commerceConfig(env: Record<string, string | undefined> = process.env, mode: "preview" | "live" = site.mode): CommerceConfig {
  const key = env.STRIPE_SECRET_KEY;
  const keyMode = stripeMode(key);
  if (!key || keyMode === "invalid") return { ok: false, error: "Checkout isn't connected yet. The store owner needs to configure Stripe (see docs/CHECKOUT.md)." };
  if (stripeMode(key) === "live" && (env.ALLOW_LIVE_PAYMENTS !== "true" || mode !== "live"))
    return { ok: false, error: "Live payments are not enabled for this store yet." };
  const store = getStore();
  if (!store) return { ok: false, error: "Inventory isn't connected yet. The store owner needs to configure Upstash Redis (see docs/CHECKOUT.md)." };
  return { ok: true, store, stripe: stripeClient(key), mode: keyMode };
}
