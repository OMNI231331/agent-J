<!-- /founder:metrics-dashboard · 2026-10-08 · input: 5 metrics for LSW pre-launch limited-drop apparel, matched to Upstash Redis inventory, Stripe checkout and the early-access webhook -->

# LSW metrics dashboard: DROP 001

## Assumptions

- Assumption: stage is pre-launch. No traffic, sales or list exist, so every current value is a placeholder.
- Assumption: first test is the 20-unit hoodie pre-order at $135 (pricing-strategy.md). Cap and price may change after supplier quotes.
- Assumption: the founder works alone and has under 15 minutes a week for review.
- Assumption: costs and the 6% return allowance come from pricing-strategy.md and are not quotes. Replace them with real figures.
- Assumption: 30, 60 and 90 days count from the day sign-ups open.

Stage: pre-launch, validation. Focus on whether strangers join and pay, not on traffic.

## The five metrics

### 1. Outside sign-ups

- Definition: cumulative email sign-ups from people outside the founder's immediate circle.
- Current: [sign-ups to date, from the webhook destination]
- Targets: 30 days 100, 60 days 200, 90 days 300. The 100 and 300 come from validate-idea.md and product-brief.md. They are proposed goals, not benchmarks. The 60-day figure is an Estimate: straight line between them.
- Decision it informs: whether the message and channel pull buyers at all.
- If below target: under 30 sign-ups by day 14 is the fail line. Swap the hook (look-first versus faith-first mockup), change one channel, and rerun for 7 days with $50 per version.

### 2. Sign-up to paid pre-order conversion

- Definition: paid orders from sign-ups divided by total sign-ups, measured within 14 days of the opening email.
- Current: [paid orders / sign-ups]
- Targets: 30 days n/a (no opening yet), 60 days 8%, 90 days 10%. Estimate: 10 paid pre-orders from 100 sign-ups is the experiment pass line (validate-idea.md), so 10%. The 8% is a stepping stone.
- Decision it informs: whether the price and offer hold up once people care.
- If below target: under 3 paid orders in 14 days is the fail line. Test $120 before changing anything else (pricing-strategy.md). Email every non-buyer one question: "What stopped you?"

### 3. Pre-order fill against cap

- Definition: paid units divided by the capped quantity for that style.
- Current: [paid units / cap]
- Targets: 30 days 50% of the 20-unit hoodie cap (10 paid), 60 days 70% inside 14 days of a full opening, 90 days 70% or more on each live style. Source: validate-idea.md and product-brief.md.
- Decision it informs: whether to produce at all, and whether to raise the next price. Pricing rules: 90% inside 14 days means raise the hoodie to $150. 60% to 89% holds. Under 60% after 60 days allows one markdown of at most 20%.
- If below target: do not order inventory. Refund the pre-orders if the cap is not met, as promised on the page.

### 4. Contribution margin per order after returns

- Definition: order revenue minus landed cost per unit sold, packaging, shipping, Stripe fee and refunded or exchanged value, per order.
- Current: [from first 10 orders]
- Targets: hoodie order at or above $51 (37.9%), blended order at or above $38 (Assumption figures from pricing-strategy.md). Landed cost at or below 35% of price (validate-idea.md, a proposed line, not an industry benchmark).
- Decision it informs: whether the drop makes money, not just revenue.
- If below target: if a real quote adds more than $10 to hoodie landed cost, margin falls to 28.7%. Raise to $150 or shrink the rhinestone motif. Stripe fee is 2.9% + $0.30 per [Stripe pricing](https://stripe.com/pricing), confirm your rate.

### 5. Return and exchange rate

- Definition: orders with an exchange or return request divided by delivered orders, 30 days after delivery.
- Current: [requests / delivered orders]
- Targets: 30 days n/a (nothing delivered), 60 days 6% or lower, 90 days 6% or lower. The 6% is the pricing allowance. Context: NRF puts 2025 online returns at 19.3% across categories ([Opensend summary](https://opensend.com/post/return-refund-rate-ecommerce)). Apparel specifically runs about 24% to 30% in secondary sources (Coresight 2023, Forrester 2021, via [size.ly](https://www.size.ly/blog/ecommerce-return-statistics)). The 6% target is aggressive for oversized fits, so expect to miss it.
- Decision it informs: size guidance and the returns policy.
- If below target: above 12% margin drops to 31.9% (pricing-strategy.md). Add measured flat dimensions to each product page and a fit note ("sized oversized, size down for a closer fit") before the next drop.

## Metrics to ignore

| Metric | Why it feels important | Why it misleads | Track instead |
|---|---|---|---|
| Followers and likes | Easy to see | Not a list you own or a buyer | Outside sign-ups |
| Site visits | Looks like demand | No payment attached | Sign-up to paid conversion |
| Total revenue | Big number | Hides cost and returns | Contribution margin per order |
| Add-to-bag count | Intent signal | Reserved stock and abandoned carts inflate it | Paid units against cap |
| Total sign-ups including friends | Reaches 100 fast | Friends rarely buy at a stranger price | Outside sign-ups |

## Tracking setup

| Need | Tool | Cost | Setup time |
|---|---|---|---|
| Sign-ups | Whatever receives `EARLY_ACCESS_WEBHOOK_URL` (a form or email service). Not set yet, so the endpoint answers 503. | Check the service's free tier | 30 minutes |
| Orders and stock | Upstash Redis, read through `listOrders` and stock keys in `lib/inventory` | Check [Upstash pricing](https://upstash.com/pricing) | 30 minutes |
| Payments, fees, refunds | Stripe Dashboard | Per transaction ([pricing](https://stripe.com/pricing)) | Already needed |
| Dashboard | One Google Sheet, one row per week | Free | 20 minutes |

Gaps in the repo today: no page analytics are installed. The Stripe webhook route (`/api/stripe/webhook`) now exists and writes each paid order to Redis, so orders and remaining stock can be read from `GET /api/admin/inventory` (see `docs/lsw/checkout-setup.md`). Nothing has been tested against live Stripe or Upstash yet. Sign-up source is always `lsw-early-access`, so outside-versus-circle needs a manual tag or a UTM-based form field.

### Events to track

1. `signup_submitted`: webhook payload received. Counts metric 1.
2. `signup_failed`: endpoint returned 502 or 503. Catches silent list loss.
3. `opening_email_sent`: starts the 14-day clock for metric 2.
4. `checkout_started`: POST to `/api/checkout` returned a URL.
5. `checkout_unavailable`: 409 returned for a variant. Shows demand against sold-out sizes.
6. `reservation_held`: stock reserved in Redis.
7. `reservation_released`: hold expired or abandoned. High numbers mean checkout friction.
8. `order_paid`: order record committed. Counts metrics 2 and 3.
9. `order_needs_review` or `refund_pending`: oversold or failed payments. Should be zero.
10. `exchange_requested`: logged by hand from email. Counts metric 5.

## Weekly review template (every Monday, 15 minutes)

```
Week of: ___
Outside sign-ups: ___ (last week: ___, target: ___)
Sign-up to paid conversion: ___% (target: ___%)
Paid units / cap: ___ / ___ (target: ___%)
Contribution per order: $___ (target: $___)
Return and exchange rate: ___% (target: 6% or lower)
Stock left by variant (from Redis): ___
Open refunds or needs_review orders: ___

What worked: ___
What did not: ___
One thing to try this week: ___
```

## Investor-ready metrics

Not raising, as far as facts.md shows. If that changes, lead with paid pre-orders from strangers and contribution margin per order. Present weak numbers as test results with the fail line stated in advance.
