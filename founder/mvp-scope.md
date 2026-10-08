<!-- /founder:mvp-scope · 2026-10-08 · input: Triage the LSW DROP 001 product and brand wishlist into must/should/won't for the flow discover, sign up, buy, receive, exchange; recommend stack for the existing Next.js site with Stripe checkout and Upstash Redis inventory; solo build estimates -->

# LSW MVP scope: DROP 001

## Assumptions

- Assumption: budget stays under $5,000 for DROP 001 and the run is 50 to 150 units per style (product-brief.md). Not confirmed.
- Assumption: US-only shipping, the checkout code's default.
- Assumption: no price, supplier quote or launch date exists. No price is decided here.
- Assumption: all build times are Estimates for one developer who already knows Next.js, at about 4 focused hours a day. They are not measured.
- Repo today: preview site with shop, product, drop, bag, policy pages. `app/api/checkout/route.ts` creates Stripe Checkout sessions, untested live. `app/api/early-access/route.ts` posts to an unconfigured webhook. Stock is not tracked yet; Redis inventory is being built.

## 1. Feature triage

| Feature | Category | Reasoning |
|---|---|---|
| Signature hoodie | Must have | The hero product. Without it there is no drop. |
| Oversized graphic tee | Must have | Cheapest item, so it is the first-purchase entry and the lowest-risk unit to produce. |
| Website: shop, product pages, drop page | Must have | Already built. Only needs real photos and confirmed copy. |
| Stripe checkout | Must have | No payment, no drop. Code exists, needs a live test. |
| Inventory cap and sold-out state (Redis) | Must have | "Limited" is the premium claim. Overselling a 100-unit run breaks it and creates refunds. |
| Email list sign-up | Must have | No audience exists. The list is the only way to reach buyers at opening and for DROP 002. |
| Shipped email with tracking | Must have | Stripe's receipt covers confirmation. Tracking stops "where is it" emails. |
| Shipping and returns policy page | Must have | Exchange step of the flow. Page exists, text must match what the founder will actually do. |
| Woven neck label | Should have | Premium signal. Fall back to a printed neck label if the minimum order is too high. |
| Baggy sweatpants | Should have | Completes a set and lifts order value, but a third garment adds a third sample round. Add only if the hoodie sample passes. |
| Rhinestone/crystal on Signature hoodie | Should have | The market gap (competitor-matrix.md), so keep one restrained crystal element. If a supplier quote breaks the budget, ship flat embroidery and say so. |
| Hang tags, care label, numbered edition, mailer | Should have | Cheap polish. Use a printed care tag, a hand-numbered hang tag and a plain black mailer. Do not claim numbering unless done. Check US care-label rules before production. |
| Discount codes, reviews, international shipping, exchange portal | Won't have | Nothing to review yet, duties and returns add risk, and email handles exchanges. |
| Statement hoodie | Won't have | Second hoodie doubles design, sample and size-run cost before anyone has paid for the first. |
| Special Edition tier | Won't have | Elaborate, smaller runs, higher price. Needs proven demand first. |
| Baggy jeans | Won't have | Denim sizing, washing and fit are the hardest to get right and hardest to exchange. |
| Beanie | Won't have | Low price, low margin, one more SKU to hold. |
| Customer accounts and login | Won't have | Stripe handles the order. Guest checkout is faster. |


## 2. MVP definition

A buyer can find LSW on social media, join the list, and in under 3 minutes pay for a limited hoodie or tee, then get a tracked package and a size exchange by email.

Features that make it work (6):

1. Signature hoodie and oversized tee, with real photos.
2. Existing store pages and drop page.
3. Stripe Checkout, tested live.
4. Redis inventory cap per style and size, with live "X left" and sold-out.
5. Email sign-up to a real list.
6. Confirmation and shipping emails, and a true shipping and returns page.

## 3. User flow

```
Step 1 Discover: buyer taps the link in an Instagram or TikTok bio and lands on the drop page.
Step 2 Sign up: buyer enters an email for opening-day access (under 15 seconds).
Step 3 Buy: on opening day buyer picks style, colour and size, sees the remaining count, and pays in Stripe Checkout.
Step 4 Receive: buyer gets Stripe's receipt, then a shipped email with tracking, then the package.
Step 5 Exchange: buyer emails the founder with order number and new size, the founder replies within a stated window.
```

Five steps. Steps 1 to 3 each take under 60 seconds. Steps 4 and 5 are manual on purpose.

## 4. Technical scope

**Stack recommendation.** Keep what exists: Next.js on Vercel, Stripe Checkout, Upstash Redis for stock, a hosted email tool for the list. Do not rewrite onto Shopify. Honest trade-off: Shopify gives carts, inventory, tax and labels out of the box, the strongest case for a solo founder. But the custom site and brand look already exist, so switching likely costs more time than it saves on a 2-style drop. Revisit if orders exceed what one person can pack. Note Stripe sessions do not reserve stock, so the webhook must decrement on payment and refund the second buyer of a last unit.

**Build vs. buy.**

| Piece | Choice | Estimate (solo, labeled) |
|---|---|---|
| Stripe Checkout live test, success page, webhook to decrement stock | Buy (Stripe), build the webhook | 1 to 2 days |
| Redis inventory, per style/size, atomic decrement, hold or release on abandoned checkout | Build on Upstash | 2 to 3 days (in progress now) |
| Remaining count and sold-out UI on product pages | Build | 0.5 day |
| Email list: connect `EARLY_ACCESS_WEBHOOK_URL` to an email tool | Buy a hosted email tool | 0.5 day |
| Shipped email with tracking | Buy (email tool, or manual first) | 0.5 day |
| Real photos, copy and policy text, domain, env vars | Founder work, no code | 1 to 2 days |
| Test purchases, mobile check, oversell test | Build/QA | 1 to 2 days |
| **Total** | | **Estimate: 7 to 11 working days, roughly 2 to 3 calendar weeks, excluding supplier lead time** |

Supplier lead times were not found or quoted, so none are stated.


**Hosting and costs (checked 2026-10-08).**

- Vercel Hobby is limited to non-commercial personal use per secondary sources, so a store that charges buyers should be on Pro, about $20 per user per month ([community thread](https://community.vercel.com/t/is-hobby-plan-suitable-for-a-saas-prototype/7205), [summary](https://deploywise.dev/blog/vercel-free-tier-limits-2026)). Vercel's own terms text was not retrieved. Confirm on Vercel before launch.
- Upstash Redis free plan: 256 MB and 500K commands a month ([Upstash docs](https://upstash.com/docs/redis/overall/billing)). Estimate: 10,000 views x 5 reads = 50,000 commands, well under.
- Stripe standard US online card rate: 2.9% + $0.30 per successful charge per third-party sources, Stripe's own page was not retrieved ([example source](https://help.moonclerk.com/en/articles/1239767-how-much-does-stripe-charge)). Confirm on stripe.com/pricing.

## 5. What you're not building, and why

1. **Statement hoodie, Special Edition tier and extra crystal work.** Why it feels important: crystals are the gap in the market. Why it can wait: one crystal element on the Signature hoodie already tests the claim, and every extra piece adds a sample round. Revisit when the hoodie sells 70% of its run in 14 days.
2. **Baggy jeans and beanie.** Why it feels important: they complete a full wardrobe. Why it can wait: a full range is not needed to learn if anyone will pay. Revisit when 60 paid orders exist and buyers ask for them.
3. **Customer accounts, discounts, reviews.** Feels normal for stores. First buyers are a few dozen. Revisit at 200 orders.
4. **Exchange portal and international shipping.** Feels important for global fans. Email handles a few dozen requests. Revisit when exchanges take over 3 hours a week.
5. **Custom packaging and woven per-unit numbering.** Feels premium. Adds cost with no evidence buyers care. Revisit at 70% sell-through.

## 6. Launch criteria

Done means:

- [ ] Trademark and domain check on LSW completed.
- [ ] A real test purchase with a live Stripe key completes and the order appears in Stripe.
- [ ] Stock for each style and size decrements on payment and the page shows sold out at zero.
- [ ] Two simultaneous purchases of the last unit do not both succeed.
- [ ] Email sign-up lands in the real list and a test email arrives.
- [ ] Shipped email with tracking works for one test order.
- [ ] Shipping and returns page matches what the founder will actually do.
- [ ] Real product photos, not concept mockups, on every for-sale page.

Can be broken or ugly: bag drawer mobile layout, manual email exchanges, plain about page.

First test with the first 10 buyers: can a buyer get from the drop link to a paid order without help, and do they receive their size correctly. Ask each one what almost stopped them.
