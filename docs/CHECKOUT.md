# Checkout, orders and inventory — setup and operations

How it works
- **Stock lives in Upstash Redis**, one counter per variant (size × color SKU). The catalog's `stock` numbers are only a demo seed for preview builds without Redis; they never sell anything.
- **Checkout** (`POST /api/checkout`): the browser sends only SKU + quantity (+ the price it displayed). The server rebuilds everything from the catalog, rejects mismatches, then **atomically reserves** stock in one Redis Lua script (all lines or nothing — it cannot oversell, however many buyers arrive at once), then creates a Stripe Checkout Session. If Stripe fails, the stock goes straight back.
- **Reservation hold:** 31 min (Stripe's minimum session life) + 10 min grace. After payment, the Stripe webhook turns the reservation into a permanent deduction and records the order.
- **Webhook** (`POST /api/stripe/webhook`): signature-verified (HMAC-SHA256, 5-min replay window), idempotent (duplicate / racing deliveries change nothing, out-of-order events can't move an order backwards).
- **Failure paths:** `checkout.session.expired`, `async_payment_failed`, cancel button → stock released. Customer pressing back → `/checkout/cancelled` expires the Stripe session and releases stock. Daily cron + a sweep before every new checkout release any hold that was missed.
- **Hoarding guard:** max 8 checkout starts per IP per 10 minutes (HTTP 429 after that; invalid carts don't count), at most 3 of one item and 6 items per order. The IP comes from Vercel's trusted `x-vercel-forwarded-for` header. Sign-ups are limited to 5 per IP per 10 minutes. It slows scripted hoarding; it doesn't stop a determined attacker with many IPs.
- **Late payment edge case:** if a payment lands after its hold was released and the stock was resold, the customer is **refunded in full automatically** (never oversold) and the order is marked `refunded`. If Stripe's refund call fails, the webhook answers 500 so Stripe retries; each retry reuses the same Stripe idempotency key, so the customer is refunded exactly once. Only if Stripe gives no payment id is the order left as `needs_attention` for a manual refund (`pnpm inventory orders`).
- **Amount check:** the subtotal Stripe charged must equal the subtotal reserved at catalog prices; if not, the order is flagged `needs_attention` for review before shipping.

## Inventory and order lifecycle

One reservation per checkout attempt. Every arrow below is a single atomic Redis script, so a retry or a duplicate delivery can never apply it twice.

```
                 start checkout (stock checked and taken, all lines or none)
                                   |
                               reserved ----- session expired / cancel / Stripe error / sweep -----> released (stock returned)
                                   |                                                                    |
              completed + paid     |   completed + unpaid (delayed method)                              | payment arrives later:
                                   |            |                                                       |   stock still there -> committed (stock re-taken)
                                   |       awaiting_payment -- async failed --> released                |   stock gone       -> customer refunded automatically (refunded)
                                   |            | async succeeded
                                   v            v
                               committed  (stock stays deducted; this is a sale)
```

| Stripe event | What happens | Order record |
|---|---|---|
| `checkout.session.completed`, paid | reservation -> committed | `paid`, fulfilment `unfulfilled` |
| `checkout.session.completed`, unpaid | reservation -> awaiting_payment (stock held, sweeper skips it) | `awaiting_payment` |
| `checkout.session.async_payment_succeeded` | -> committed | `paid` |
| `checkout.session.async_payment_failed` | stock returned | `payment_failed` |
| `checkout.session.expired` | stock returned | none |
| declined card inside Checkout | nothing: the customer can retry on the same session, the hold lasts until it expires | none |
| paid, but the hold was released and the stock was resold | never oversold; **refunded in full automatically** (retried safely if Stripe errors) | `refunded` (`needs_attention` only if Stripe gave no payment id) |
| paid, but Stripe's subtotal differs from what was reserved | stock stays sold | `needs_attention`: check before shipping |

Order status only moves forward: `awaiting_payment` < `payment_failed` < `paid` < `needs_attention` < `refunded`. A late or replayed "failed" event cannot overwrite a paid order. A webhook that fails halfway is not marked done, so Stripe's retry finishes it (commit and order-write are both safe to repeat).

**What an order records** (`pnpm inventory orders`): internal reservation id, Stripe session id, PaymentIntent id (for refunds and reconciliation), items (SKU, name, color/size, quantity, catalog price when recorded), Stripe subtotal and total, currency, customer email and name, the shipping name and address, status, fulfilment status (`unfulfilled`, `shipped`, `cancelled`) with tracking, and timestamps. No card data is ever seen or stored.

**Fulfilling and refunds:** `pnpm inventory fulfill <session_id> shipped [tracking]` or `cancelled`. Only `paid` (and reviewed `needs_attention`) orders can be fulfilled; `refunded` ones cannot. Oversold late payments are refunded automatically; any other refund is issued in the Stripe Dashboard (use the PaymentIntent id shown by `orders`), then mark the order `cancelled`.

**Reconciling with Stripe** (Stripe is the record of payments, Redis is the working copy): `pnpm inventory reconcile --days 7` lists completed Stripe sessions that have no order here, or whose status disagrees. `--apply` rebuilds them through the same idempotent webhook code (safe to repeat), including the automatic refund when a lost payment's stock was resold. Run it after any Redis or webhook outage, and weekly. Amount differences are reported and never auto-changed.

**Logs:** the webhook writes one JSON line per event (`"app":"lsw"`, `evt`, `eventId`, `type`, `sessionId`, `reservationId`, `outcome`). No email, name, address or payment ids are logged. In Vercel: Project -> Logs -> search `webhook_failed` and `webhook_rejected`.

**If Redis is down:** checkout answers 503 ("temporarily unavailable"), the shop shows availability as unconfirmed, and the webhook answers 500 so Stripe retries for days. Nothing is charged without a reservation. Run `reconcile` once Redis is back.

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
| `NEXT_PUBLIC_SITE_URL` | your site URL, e.g. `https://yourdomain.com`. **Live mode refuses to start a checkout unless this is an `https://` URL**; it never trusts the request's Host header for the return links |
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
npm i -g vercel && vercel link      # one-time: install the Vercel CLI and link this folder to the project
vercel env pull .env.local --environment=preview   # variables marked Sensitive are NOT pulled; for those, paste UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN into .env.local by hand
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
   - `pnpm inventory orders` → **exactly one** `paid` order with the amount, email, shipping address, payment id and `fulfilment unfulfilled`.
   - Stripe → Developers → Webhooks → the endpoint → recent deliveries show **200**.
   - `pnpm inventory reconcile --days 1` → "consistent: 1, missing: 0".
4. Failure paths: card `4000 0000 0000 0002` (declined — stay on Stripe's page, stock stays held until it expires or you press back); press **← back** on Stripe's page → "Checkout cancelled" and stock returns; in Stripe's webhook page use **Resend** on a delivered event → still one order, stock unchanged.
5. Oversell check: set a SKU to `1`, open checkout in two browsers, start checkout in both — the second gets "sold out".
6. Replay: in Stripe's webhook page **Resend** the paid event twice → still one order, stock unchanged (`pnpm inventory orders`, `show`).
7. Expiry: start a checkout and close the tab. After ~31 minutes Stripe sends `checkout.session.expired` and `show` returns the stock; or run `stripe checkout sessions expire <cs_...>` to try it immediately.
8. Ship it: `pnpm inventory fulfill <session_id> shipped TRACKING123` → `orders` shows `shipped`.

## 6. Automated tests
```bash
pnpm typecheck   # the app, plus scripts/ and tests/
pnpm test        # needs redis-server installed locally; 103 tests on real Redis (the production Lua scripts run for real, Stripe is faked):
                 #   stock limits and concurrent buyers, duplicate/racing webhooks, expired/failed/delayed payments, automatic refunds
                 #   and refund retries, signatures, cart validation (tampered price/SKU/size/colour/quantity), Redis outages,
                 #   webhooks that fail halfway, order completeness, status ordering, fulfilment, Stripe reconciliation
pnpm build && pnpm smoke   # 16 steps against the built app (real Upstash client + fake Stripe): purchase, replay, refund, cancel, rate limit,
                           # cron, plus the real inventory CLI: orders, fulfill, and reconcile (finds a paid session with no order and rebuilds it)
```
CI (`.github/workflows/test.yml`) runs all of these on every pull request.

## Launch blockers and known limitations (read before taking real money)
1. **Not yet tested against real Stripe and real Upstash.** Steps 1-5 above are the proof.
2. **Orders live in Redis.** That is a working copy, not a ledger or order-management system. Stripe holds the authoritative payment record. Export orders regularly (`pnpm inventory orders 500`), and move to a durable database (for example Postgres) before order volume grows. `reconcile` protects against lost orders, not against losing Redis history.
3. **Shipping is free unless you set `STRIPE_SHIPPING_RATE_ID`.** Create a shipping rate in Stripe and set it, or every order ships at your cost. Sales tax is off unless `STRIPE_AUTOMATIC_TAX=true` and Stripe Tax is set up. Only US addresses are accepted.
4. **No emails from this site.** Receipts come from Stripe (enable them). There is no "your order shipped" email.
5. **`needs_attention` orders need a person.** They mean "paid, but check before shipping" (amount mismatch) or, rarely, an oversold payment with no payment id to refund automatically. Nothing alerts you yet: check `pnpm inventory orders` daily during a drop.
6. **A delayed-payment session that never reports back** keeps its stock held (the sweeper deliberately skips `awaiting_payment`). Card-only checkout does not produce these; if you enable bank debits, run `reconcile` daily.
7. Per-IP rate limiting uses `x-forwarded-for`, which Vercel sets; it is not a defence against many IPs.
8. Preview mode shows the catalog's demo stock when Redis is not configured. Those counts are demo data, not inventory, and live mode never shows them.

## What these tests do **not** cover
- Real Stripe and real Upstash over the internet (only test doubles/local Redis here) — **step 5 is the real proof; do it before anything else.**
- Real card networks, 3-D Secure flows, real refunds against Stripe (the refund logic is tested against a fake Stripe), disputes, tax correctness, shipping rates.
- A real browser purchase end to end on a deployed site.
- Email delivery of receipts. Order-management UI (orders are in Redis; read them with `pnpm inventory orders`).
- Vercel Cron on the Hobby plan runs at most daily; the webhook + pre-checkout sweep are the primary release paths.

## Going live (do not skip)
1. Complete step 5 end to end in test mode, including the failure paths, on a deployed preview.
2. Confirm real prices (`pricing: "confirmed"` in `lib/catalog.ts`), real stock, shipping rate, tax setup and the policy pages.
3. Create the **live-mode** webhook endpoint + keys, and set Production variables: `STRIPE_SECRET_KEY=sk_live_…`, live `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STORE_MODE=live`, `ALLOW_LIVE_PAYMENTS=true`. All of these gates must be on or live keys are refused.
4. Make one small real purchase and refund it.
