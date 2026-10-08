<!-- /founder:go-to-market · 2026-10-08 · input: Go-to-market for LSW DROP 001 limited-drop streetwear: pre-launch audience building, capped hoodie pre-order matching validate-idea experiment 1, drop-day plan, 90-day plan, $0 to $500 a month, real stock tracked in Redis -->

# LSW go-to-market: DROP 001

## Assumptions

- Assumption: launch stage is pre-launch. No launch date, audience, list or following exists (facts.md). Day 0 is the day the pre-order opens.
- Assumption: the founder works alone and has no paid team.
- Assumption: the first sale is the 20-unit hoodie pre-order from validate-idea.md Experiment 1, at the $135 launch price from pricing-strategy.md. Tee and sweatpants wait until the hoodie passes.
- Assumption: production starts only when 10 paid orders exist (the pass line in product-brief.md). If a supplier minimum is higher than 10 or 20 units, this mechanic changes. Supplier minimums for LSW: Not found, no quotes exist.
- Assumption: budget is $0 to $500 a month, and the $5,000 DROP 001 ceiling is unconfirmed.
- All targets are proposed goals, not predictions. All CAC figures are estimates.

## 1. Launch readiness

- **Minimum to launch:** one hoodie, real photos (not concept mockups), live Stripe test, Redis stock count live, real email list, true shipping and returns page. This is the launch criteria list in mvp-scope.md. Estimate from that file: 7 to 11 working days of build.
- **Reach sanity check:** the audience is unproven. 39% of Gen Z clothing buyers found a new apparel brand on social media in the prior six months ([eMarketer](https://www.emarketer.com/content/gen-zs-path-purchase), survey year not confirmed). That shows the channel works for discovery, not that LSW will be found.
- **Biggest risk:** spending on inventory before strangers pay. Second risk: LSW trademark is unchecked, so run that check before labels or ads.
- **Blocker to flag:** the 20-unit cap only works if a supplier will make that few. One directory lists 50 per style at one shop and 250 at another ([SourceReady](https://www.sourceready.com/supplier/list/best-custom-clothing-manufacturers-for-startups), [SourceReady](https://www.sourceready.com/supplier/list/custom-apparel-manufacturers)). Confirm before opening.

## 2. Pre-launch (weeks -4 to 0)

### Where the audience gathers (checked 2026-10-08)

| Place | Verified facts | How LSW uses it |
|---|---|---|
| [r/streetwear](https://www.reddit.com/r/streetwear/) | About 5.1 million members per a now-closed stats site (dated). Post types include an "Advert" flair; buy/sell/trade is not allowed ([rules wiki mirror](https://lr.sudovanilla.org/r/streetwear/wiki/rules)). Self-promo ratio rule: Not found | Comment and give fit feedback for 2 weeks. One post on drop day, using the Advert flair |
| [r/streetwearstartup](https://www.reddit.com/r/streetwearstartup/) | Described as a space for brand owners to share ideas and showcase brands ([GummySearch listing](https://gummysearch.com/r/streetwearstartup/)). Current activity: Not found, check before posting | Ask for feedback on the tech pack and sample. Peer advice, not buyers |
| Discord streetwear servers | Business of Fashion calls Discord a gathering place for streetwear and sneaker fans ([BoF](https://www.businessoffashion.com/articles/technology/the-gamer-chat-app-influencing-menswear)). Glossy warns servers need constant cleanup against spam ([Glossy](https://www.glossy.co/fashion/the-trials-and-tribulations-of-fashion-brands-using-discord/)) | Skip your own server for now. Join existing ones only where self-promo is allowed |
| [r/TrueChristian](https://www.reddit.com/r/TrueChristian/) (about 214K) and [r/Christian](https://www.reddit.com/r/Christian/) (about 157K) ([Hive Index](https://thehiveindex.com/communities/r-truechristian/)) | Counts are third-party. Rules on promotion: Not found | Listen only. Do not post the shop. These are faith discussion spaces |
| Instagram and TikTok | Persona discovery channels (persona-gen.md) | Main channel, see section 4 |

Reddit norm to follow: treat about 10% of your activity as own-content, and disclose that it is your brand. The 10% is a community rule of thumb, not a site rule ([Redship](https://redship.io/blog/reddit-self-promotion-rules-2026)). Subreddit rules are stricter, so read each sidebar first.

### Five posts before launch

1. **TikTok and Instagram Reels, week -4:** "Why LSW exists", 30 seconds, founder on camera, no verses in the first line. Lead with the look, per validate-idea Experiment 2.
2. **TikTok and Reels, week -3:** sample unboxing and fabric close-up (weight, stitching, label). Answers Diego's and Janelle's quality worries (persona-gen.md).
3. **Instagram carousel, week -2:** size chart with real measurements and fit photos on a real body. Only post this once a sample exists.
4. **TikTok and Reels, week -1:** design walkthrough of the original cross and star motif, sketch to sample.
5. **r/streetwearstartup text post, week -2:** ask for feedback on the hoodie sample. Disclose it is your brand.

### Email list: yes

- **Reason to join:** 24-hour early access link and the real count of units, not a discount.
- **Tool caution:** Mailchimp's free plan is 250 contacts and 500 sends a month as of 2026 ([Groupmail](https://blog.groupmail.io/mailchimp-free-plan-changes-2026/)). The 300 sign-up target exceeds that. MailerLite's free cap appears to be 250 subscribers too, unconfirmed against its own page ([Costbench](https://costbench.com/software/marketing-automation/mailerlite/free-plan/)). Budget for a paid tier or pick a tool with a higher free cap. Pricing not verified here.
- **Sign-up wiring:** `app/api/early-access/route.ts` posts to an unconfigured webhook today (mvp-scope.md). Connect it before any post goes live.

### Assets

- **Landing page:** drop page with the live remaining count, size chart, fabric weight, ship date and refund terms. Copy via `/founder:landing-page`.
- **Video:** vertical, 20 to 40 seconds, show fabric, the embroidered or crystal detail and the label. Shoot on a phone.
- **Social proof without customers:** no reviews, no testimonials, no placeholder quotes. Use process proof (sample photos, supplier visit, fabric swatch). After shipping, ask real buyers for fit photos, with permission. Fake reviews and bought followers are banned under the FTC's 2024 rule, with civil penalties for knowing violations ([FTC](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials)).

## 3. The capped pre-order (matches validate-idea Experiment 1)

| Item | Setting |
|---|---|
| Product | Signature hoodie, one colorway |
| Price | $135 launch price (pricing-strategy.md) |
| Cap | 20 units. The Redis stock key for each size is set so the total is 20. The page count is read from Redis, never typed |
| Production trigger | 10 paid orders in 14 days, at least 5 from people the founder does not know |
| If under 10 | Full refund, stated before checkout. Under 3 means test $120 first (pricing-strategy.md) |
| Ship date | A stated date. Estimate by supplier lead time: Not found, no quote. Ship within 30 days or send the delay-option notice the FTC rule requires, with a cancel-and-refund choice ([FTC guide](https://ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule)) |

Scarcity rules:
- "X left" shows the Redis number. No timers that reset, no "only 3 left" unless 3 are left.
- Do not claim "sold out" until Redis reads 0.
- If the cap is hit, close it. Do not reopen the same edition. A second run is called DROP 002.
- Print edition numbers only if the units are actually numbered.
- Abandoned checkouts hold stock until the hold expires (lib/inventory). Do not call a hold a sale in public counts.

## 4. Launch day (day 0)

Pick three: Instagram, TikTok, Reddit. Product Hunt, Hacker News and LinkedIn do not fit an apparel buyer. X is optional.

- **Time:** Assumption: weekday 6 to 8 pm Central, after school and work. No sourced best time, so check which hour your first posts get views.
- **Email, hour 0:** the early-access list gets the link 24 hours first, then the public link goes live.
- **TikTok:** one video at open showing the real remaining count and the sample. Turn on TikTok's commercial content disclosure when promoting your own brand ([TikTok Ads Help](https://ads.tiktok.com/help/article/about-the-content-disclosure-setting-for-creators)).
- **Instagram:** Reel plus Story with link sticker. Post the count update at 5 left only if 5 are left.
- **Reddit:** one r/streetwear post with the Advert flair, a short story and photos. Disclose it is yours. Answer every comment. Skip it if the mods' rules say otherwise.
- **Run sheet:** test purchase 1 hour before, watch Stripe and Redis, answer DMs for 3 hours, send every buyer a confirmation with ship date.

## 5. Post-launch growth (days 1 to 90)

### Channel ranking

| # | Channel | CAC (Estimate) | Time to results | First action this week |
|---|---|---|---|---|
| 1 | Organic TikTok and Reels, founder-made | $0 to $10 per order. $0 ad spend, about 10 hours a week, assumed 20 orders (product-brief.md) | 2 to 4 weeks | Film the first "why LSW" video |
| 2 | Email list from every post | Under $5 per sign-up, Estimate: $150 ad budget / 30+ sign-ups | Weeks 1 to 4 | Pick a tool and connect the sign-up route |
| 3 | Paid Meta and TikTok to sign-up page | $20 to $40 per order, placeholder (product-brief.md) | 2 weeks | Wait for 2 posts to show what the audience likes, then spend $50 per version |
| 4 | Gifted pieces to micro-creators and youth-group leaders | $15 to $35 per order, depends on unit cost (not known) | 4 to 8 weeks | List 10 creators who fit Janelle's profile, none contacted yet |
| 5 | Reddit and Discord | $0 cash, time only | 4 to 8 weeks | Read rules, comment for 2 weeks |

Gifted pieces must carry a disclosure. TikTok treats gifting as a commercial relationship ([TikTok Ads Help](https://ads.tiktok.com/help/article/about-the-commercial-content-disclosure-setting-for-advertisers)).

### Five content ideas

1. "Heavyweight hoodie, what the weight means" (search intent: heavyweight oversized hoodie). Reels, TikTok, blog.
2. "How LSW hoodies fit: measurements on three body types." Instagram carousel, reused as the size page.
3. "From sketch to sample: the cross motif." TikTok series, reused for Reddit feedback post.
4. "Faith and streetwear without the slogan." Founder talk, 60 seconds, for church youth groups and Instagram.
5. "Behind DROP 001: cost, count, ship date." Plain post on real numbers, builds trust, reuse in email.

### Communities, partnerships, tactic

- **Communities:** [r/streetwear](https://www.reddit.com/r/streetwear/), [r/streetwearstartup](https://www.reddit.com/r/streetwearstartup/), and one active Discord streetwear server (name: Not found, search by invite directory before joining).
- **Partnerships:** (1) a local youth pastor or campus ministry leader who wears the piece, gifted and disclosed. (2) one micro-creator in faith-and-fashion with an audience under 50K. Neither named; no outreach has been done.
- **Product-specific tactic:** numbered hang tags. Number only what is true and let buyers claim their number publicly.

## 6. Metrics (proposed, days 30, 60, 90)

| Metric | Day 30 | Day 60 | Day 90 | Tool | If below target |
|---|---|---|---|---|---|
| Email sign-ups | 100 | 200 | 300 | Email tool | Swap the hook video; test the look-first vs faith-first message |
| Paid orders | 10 | 35 | 60 | Stripe | Check price ($120 test) and fit proof before more ads |
| Sell-through of the 20 cap | 50% | n/a | n/a | Redis | Do not raise the cap; fix the offer |
| Store conversion | 1.5% | 2% | 2% or higher | Vercel Analytics or Stripe | Fix page load, size help, shipping clarity |
| Buyer posts or tags | 3 | 6 | 10 | Instagram tags | Ask buyers for fit photos with a thank-you note |

Full setup: `/founder:metrics-dashboard`.

## 7. Budget ($0 to $500 a month)

| Month | Spend | Split |
|---|---|---|
| 1 | Up to $250 | Ads $150 (Experiment 1), message test $100 (Experiment 2). Email tool free if under cap |
| 2 | Up to $350 | Samples, fit photos, ads $150, email tier if over cap |
| 3 | Up to $500 | Only if sell-through hits 70%; ads $250, gifted pieces, DROP 002 sample |

- **Free:** all organic video, email list, Reddit participation, DMs to youth leaders, process content.
- **Worth paying for:** real photos, email tool when the list passes the free cap, small tested ads.
- **Best spend under $200:** the $150 ad test to the sign-up page. It is the only spend that tells you whether strangers care before you buy inventory. Fund ads only after two organic posts show what the audience reacts to.
- **Do not spend** on followers, reviews or inventory before 10 paid orders.

Next skills: `/founder:landing-page`, `/founder:email-sequence`.
