import Stripe from "stripe";

/** The slice of the Stripe SDK we use. The real SDK satisfies it; tests pass a fake. */
export interface StripeLike {
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions): Promise<{ id: string; url: string | null }>;
      expire(id: string): Promise<unknown>;
    };
  };
  refunds: { create(params: Stripe.RefundCreateParams, options?: Stripe.RequestOptions): Promise<unknown> };
  webhooks: { constructEvent(payload: string, header: string, secret: string): Stripe.Event };
}

let cached: StripeLike | null | undefined;

/** Why this key must not be used, or null if it is fine. Live keys need an explicit opt-in. */
export function keyProblem(key: string | undefined): string | null {
  if (!key) return "Checkout isn't configured yet.";
  const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  if (live && process.env.ALLOW_LIVE_PAYMENTS !== "true") {
    return "Live payments are switched off. Use a Stripe test key, or set ALLOW_LIVE_PAYMENTS=true after the test checklist passes.";
  }
  return null;
}

/** Server only. Returns null when no key is set or a live key has not been approved. */
export function getStripe(): StripeLike | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = keyProblem(key) ? null : (new Stripe(key as string) as unknown as StripeLike);
  return cached;
}

export function __setStripeForTests(s: StripeLike | null | undefined) {
  cached = s;
}

export function getSiteUrl(): string | null {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : null;
}
