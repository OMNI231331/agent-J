# LSW checkout, orders and inventory: setup and testing

What was built: Stripe Checkout, a signed Stripe webhook, and stock/orders in Upstash Redis.
Status: the logic passes 84 automated tests locally (see "What is and isn't tested"). It has **not** been run against a real Stripe or Upstash account, so treat it as ready for **test-mode** trials only, not for real customers.

Dashboard screens change names often. The steps below say what to find; if a label differs, look for the closest match.

## How it works (so the steps make sense)

1. A shopper presses Checkout. The server re-checks every item against `lib/lsw.ts` (prices are never taken from the browser) and **reserves** the stock in Redis in one atomic step. If any item is short, nothing is reserved.
2. It opens a Stripe Checkout Session (valid 31 minutes) and sends the shopper there. The stock stays held.
3. Stripe calls `/api/stripe/webhook`. After the signature is verified:
   - `checkout.session.completed` (paid) turns the hold into an order. Each Stripe event id is processed once, and the order step is safe to repeat.
   - `checkout.session.expired`, `checkout.session.async_payment_failed`, or pressing back on Stripe's page returns the stock.
   - `payment_intent.payment_failed` keeps the hold: a declined card lets the shopper try another card.
4. Backstops: each new checkout first returns any expired holds, and `/api/cron/sweep` does the same once a day.
5. If a payment lands after its hold was released and the unit has since sold, the customer is refunded automatically and the order is marked `refund_pending`.

## 1. Upstash Redis

**Option A: through Vercel (simplest).**
1. Vercel dashboard, your project, **Storage** (or the Marketplace), add **Upstash Redis** (create a database; pick a region near your Vercel functions, usually US East).
2. Connect it to the project for Production and Preview. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. The code reads those names.

**Option B: directly at upstash.com.**
1. Create a free account, **Create Database**, choose a region near your Vercel region.
2. On the database page, open the **REST API** section and copy the **URL** and **Token**. These become `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Do not use the "read-only token". Never expose either value in browser code (nothing here does).

## 2. Environment variables in Vercel

Project, **Settings**, **Environment Variables**. Add each for **Production** and **Preview** (use test values for both until launch), then **redeploy** (env changes apply only to new deployments).

| Name | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from step 1 (skip if the Vercel integration set `KV_REST_API_*`) |
| `STRIPE_SECRET_KEY` | your **test** secret key, starts with `sk_test_` |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` from step 3 |
| `SITE_URL` | your site's public URL with no trailing slash, e.g. `https://lsw-store.vercel.app` |
| `ADMIN_TOKEN` | a long random string (24+ characters). Generate one: `openssl rand -hex 32` |
| `CRON_SECRET` | another long random string (Vercel sends it to the cron job automatically) |
| `STRIPE_ALLOWED_COUNTRIES` | `US` (comma-separated list to add more) |
| `ALLOW_LIVE_PAYMENTS` | leave **unset** or `false` for now |
| `EARLY_ACCESS_WEBHOOK_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | optional here; needed for sign-ups and the contact page |

The site refuses `sk_live_` keys unless `ALLOW_LIVE_PAYMENTS=true`, so a mistake cannot charge real cards.

## 3. Stripe webhook (test mode)

1. In the Stripe dashboard, switch to **test mode** (or a sandbox).
2. **Developers**, **API keys**: copy the test **Secret key** into `STRIPE_SECRET_KEY`.
3. **Developers**, **Webhooks**, **Add endpoint**:
   - URL: `https://YOUR-DOMAIN/api/stripe/webhook`
   - Events to send (select exactly these):
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`
4. Open the endpoint and reveal its **Signing secret** (`whsec_...`). Put it in `STRIPE_WEBHOOK_SECRET` and redeploy.
5. In your Stripe account settings, decide whether Stripe should email customers receipts. The code does **not** send order-confirmation emails itself.

Local development: install the Stripe CLI, run `stripe login`, then `stripe listen --forward-to localhost:3000/api/stripe/webhook`. It prints a `whsec_...` for `.env.local`.

## 4. Put real stock in Redis

Nothing can be bought until a variant has stock. Set it with your admin token (replace the domain and token):

```bash
curl -X POST https://YOUR-DOMAIN/api/admin/inventory \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"updates":[
    {"slug":"signature-hoodie","colorId":"charcoal","size":"M","qty":3,"mode":"set"},
    {"slug":"signature-hoodie","colorId":"charcoal","size":"L","qty":2,"mode":"set"}
  ]}'
```

`mode: "set"` writes the amount available to sell now. `mode: "add"` adds (or subtracts, with a negative number) and refuses to go below zero. Use `add` when customers may be mid-checkout. Only set real quantities you actually hold or will have made.

Check stock and orders any time:

```bash
curl https://YOUR-DOMAIN/api/admin/inventory -H "Authorization: Bearer $ADMIN_TOKEN"
```

Product pages grey out sizes with no stock and show **Sold out** when nothing is left. They never show counts.

## 5. Test a complete purchase (test mode only)

Use Stripe's test cards (any future expiry, any CVC, any ZIP): success `4242 4242 4242 4242`, decline `4000 0000 0000 0002`, 3-D Secure `4000 0025 0000 3155`.

1. Set stock for one variant to `2` (step 4).
2. Open a product page, pick that variant, **Add to bag**, **Checkout**. You land on Stripe's page.
   - Check: the admin GET shows stock `1` (one held).
3. Pay with `4242...`. You return to `/checkout/success` and the bag empties.
   - Check: Stripe dashboard, Webhooks, the endpoint shows `checkout.session.completed` with a `200`.
   - Check: admin GET shows stock still `1` and one order (`status: "paid"`, with email and shipping address).
4. **Duplicate webhook:** in Stripe, open that event and press **Resend**. Response should say `duplicate`; still exactly one order, stock unchanged.
5. **Declined card:** start another checkout, pay with `4000 0000 0000 0002`. It is declined; the hold stays (stock `0`). Close the tab. Within about 31 minutes Stripe sends `checkout.session.expired` and stock returns to `1`.
6. **Canceled checkout:** start a checkout, press the back arrow on Stripe's page. You return to the shop with a notice, and stock returns to `1` immediately.
7. **Last-unit race:** with stock `1`, start two checkouts at nearly the same time in two browsers. One reaches Stripe; the other is told it is sold out.
8. **Bad signature:** `curl -X POST https://YOUR-DOMAIN/api/stripe/webhook -d '{}'` must return `400`.
9. **Sold out display:** after the stock reaches 0, the product page shows **Sold out**.

Only when every step behaves as described, consider going live.

## 6. Before real money (not done yet)

- **Do not** set `ALLOW_LIVE_PAYMENTS=true` until step 5 has passed in test mode on your deployed site.
- Switch Stripe to live mode: new live `sk_live_` key, and a **new** live webhook endpoint with its own `whsec_`. Update both variables, then set `ALLOW_LIVE_PAYMENTS=true`, redeploy, and place one small real order yourself and refund it.
- Orders live in Redis. Redis is a cache-grade store, not a ledger: export orders regularly (admin GET), and keep Stripe as your record of payments. Upstash's plan and backup options should be checked before relying on it.
- Fulfillment is manual: read paid orders from the admin GET (or the Stripe dashboard) and ship them. There is no customer confirmation or shipping email yet.
- Decide and publish real shipping, returns, privacy and terms text (the pages are drafts), sales tax, and the LSW trademark check.
- Vercel's free Hobby plan is intended for non-commercial use per its terms; a store that takes payments should be on a paid plan. Confirm on vercel.com before launch.
- Vercel Cron on Hobby runs at most once a day. That is fine: expired holds are also returned at the start of each new checkout.
- Add `/api/admin/*` access limits if you share the token with anyone, and rotate `ADMIN_TOKEN` if it is ever exposed.

## What is and isn't tested

Run `pnpm test` (needs `redis-server` installed; CI installs it). 84 tests pass locally:

- **Stock limits and concurrency (real Redis, real Lua):** 100 shoppers racing for 7 units sell exactly 7; multi-unit and multi-item races; all-or-nothing carts; stock never negative.
- **Webhook:** signature checks (missing, wrong secret, tampered body, no secret); one order and one stock deduction when the same event arrives 10 times at once; different events for one payment; stale `expired` after payment; failed, expired and delayed payments; late payment with and without stock (refund once); amount mismatch flagged; unknown paid session fails so Stripe retries.
- **Checkout:** server-side validation of products, colors, sizes and quantities; client-sent prices ignored; last-unit race through the checkout code; Stripe outage returns the stock; rate limit; cancel and abandoned holds; live-key guard.
- **Routes and the production Upstash client:** the real `@upstash/redis` client was run against a local emulation of Upstash's REST protocol in front of real Redis.

**Not tested:** a real Stripe account (the Stripe API calls are faked in tests; only webhook signature maths uses the real SDK), a real Upstash database, Vercel itself, and a real browser purchase end to end. The test-mode walkthrough above is how you close that gap.
