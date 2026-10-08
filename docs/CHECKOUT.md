# Checkout, orders and inventory — setup and operations

How it works
- **Stock lives in Upstash Redis**, one counter per variant (size × color SKU). The catalog's `stock` numbers are only a demo seed for preview builds without Redis; they never sell anything.
- **Checkout** (`POST /api/checkout`): the browser sends only SKU + quantity (+ the price it displayed). The server rebuilds everything from the catalog, rejects mismatches, then **atomically reserves** stock in one Redis Lua script (all lines or nothing — it cannot oversell, however many buyers arrive at once), then creates a Stripe Checkout Session. If Stripe fails, the stock goes straight back.
- **Reservation hold:** 31 min (Stripe's minimum session life) + 10 min grace. After payment, the Stripe webhook turns the reservation into a permanent deduction and records the order.
- **Webhook** (`POST /api/stripe/webhook`): signature-verified (HMAC-SHA256, 5-min replay window), idempotent (duplicate / racing deliveries change nothing, out-of-order events can't move an order backwards).
- **Failure paths:** `checkout.session.expired`, `async_payment_failed`, cancel button → stock released. Customer pressing back → `/checkout/cancelled` expires the Stripe session and releases stock. Daily cron + a sweep before every new checkout release any hold that was missed.
- **Hoarding guard:** max 8 checkout starts per IP per 10 minutes (HTTP 429 after that), plus per-item limit of 3. It slows scripted hoarding; it doesn't stop a determined attacker with many IPs.
- **Late payment edge case:** if a payment lands after its hold was released and the stock was resold, the customer is **refunded in full automatically** (never oversold) and the order is marked `refunded`. If Stripe's refund call fails, the webhook answers 500 so Stripe retries; each retry reuses the same Stripe idempotency key, so the customer is refunded exactly once. Only if Stripe gives no payment id is the order left as `needs_attention` for a manual refund (`pnpm inventory orders`).
- **Amount check:** the subtotal Stripe charged must equal the subtotal reserved at catalog prices; if not, the order is flagged `needs_attention` for review before shipping.

## 1. Upstash Redis
1. Create an account at https://console.upstash.com → **Create database** → name `lsw-inventory`, type *Regional*, a region close to your Vercel functions (US East if unsure), TLS on.
2. Open the database → **REST API** section → copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.
   *(Alternative: in Vercel → Storage / Marketplace → add **Upstash Redis** to the project. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the app accepts either pair.)*
3. Keep the token secret. It must never be a `NEXT_PUBLIC_` variable.

## 2. Vercel environment variables
Vercel → your project → **Settings → Environment Variables**. Add each for **Preview** (and Production once you are ready; use **Sensitive** for secrets). Redeploy afterwards — variables only apply to new deployments.

| Name | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from step 1 (skip if the Vercel integration added `KV_*`) |
| `STRIPE_SECRET_KEY` | **`sk_test_…`** from Stripe test mode (Developers → API keys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 3 |
| `CRON_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
| `NEXT_PUBLIC_SITE_URL` | your site URL, e.g. `https://yourdomain.com` |
| `NEXT_PUBLIC_STORE_MODE` | `preview` for now |
| `ALLOW_LIVE_PAYMENTS` | `false` |
| optional: `STRIPE_SHIPPING_RATE_ID`, `STRIPE_AUTOMATIC_TAX` | see `.env.example` |

The daily cron (`vercel.json`) calls `/api/cron/release-reservations` with `Authorization: Bearer $CRON_SECRET`; Vercel adds that header automatically when `CRON_SECRET` is set.

## 3. Stripe webhook (test mode)
1. Stripe Dashboard → turn on **Test mode** → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://<your-deployment-or-domain>/api/stripe/webhook`.
3. Select exactly these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
4. Create it, reveal the **Signing secret** (`whsec_…`) and put it in `STRIPE_WEBHOOK_SECRET`. Redeploy.
5. Also in Stripe: **Settings → Emails** → enable *customer emails for successful payments* — otherwise buyers get no receipt (this site doesn't send its own order emails yet).
Local development: `stripe listen --forward-to localhost:3000/api/stripe/webhook` prints a temporary `whsec_…` to use locally.

## 4. Put stock in Redis
```bash
vercel env pull .env.local          # or create .env.local with the two Upstash values
pnpm inventory show                 # every SKU; "not stocked" until you set it
pnpm inventory seed 3 --yes         # TEST ONLY: 3 of every SKU (refuses if anything is already stocked)
pnpm inventory set LSW001-HOOD-WASHED-BLACK-M 12     # absolute count — only when no checkouts are open
pnpm inventory add LSW001-HOOD-WASHED-BLACK-M +5     # restock/correct safely while selling
```
Use the **real production counts** for each SKU only after the garments exist. Don't invent numbers.

## 5. Test a complete purchase (Stripe test mode)
1. Open your preview deployment → a product → pick color + size → **Add to bag** → **Checkout**.
2. Pay with card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
3. You land on **Order confirmed**. Then check:
   - `pnpm inventory show` → that SKU is down by what you bought.
   - `pnpm inventory orders` → a `paid` order with the amount and email.
   - Stripe → Developers → Webhooks → the endpoint → all four recent deliveries show **200**.
4. Failure paths: card `4000 0000 0000 0002` (declined — stay on Stripe's page, stock stays held until it expires or you press back); press **← back** on Stripe's page → "Checkout cancelled" and stock returns; in Stripe's webhook page use **Resend** on a delivered event → still one order, stock unchanged.
5. Oversell check: set a SKU to `1`, open checkout in two browsers, start checkout in both — the second gets "sold out".

## 6. Automated tests
```bash
pnpm typecheck
pnpm test        # needs redis-server installed locally; 52 tests on real Redis: stock limits, concurrent buyers, duplicate/racing webhooks, expired/failed payments, automatic refunds and refund retries, signatures, validation
pnpm build && pnpm smoke   # full purchase against the built app (real Upstash client + fake Stripe)
```
CI (`.github/workflows/test.yml`) runs all of these on every pull request.

## What these tests do **not** cover
- Real Stripe and real Upstash over the internet (only test doubles/local Redis here) — **step 5 is the real proof; do it before anything else.**
- Real card networks, 3-D Secure flows, real refunds against Stripe (the refund logic is tested against a fake Stripe), disputes, tax correctness, shipping rates.
- Email delivery of receipts. Order-management UI (orders are in Redis; read them with `pnpm inventory orders`).
- Vercel Cron on the Hobby plan runs at most daily; the webhook + pre-checkout sweep are the primary release paths.

## Going live (do not skip)
1. Complete step 5 end to end in test mode, including the failure paths, on a deployed preview.
2. Confirm real prices (`pricing: "confirmed"` in `lib/catalog.ts`), real stock, shipping rate, tax setup and the policy pages.
3. Create the **live-mode** webhook endpoint + keys, and set Production variables: `STRIPE_SECRET_KEY=sk_live_…`, live `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STORE_MODE=live`, `ALLOW_LIVE_PAYMENTS=true`. All of these gates must be on or live keys are refused.
4. Make one small real purchase and refund it.
