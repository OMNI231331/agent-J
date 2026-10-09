# Facts the founder stated

One fact per line: date · who recorded it · fact. Only things the founder said. Estimates never go here.

- 2026-10-08 · initial brief · The brand is called LSW. Category: premium limited-edition streetwear.
- 2026-10-08 · initial brief · Core message: Faith / Discipline / Purpose. The brand has Christian, faith-centered meaning but designs should stay fashionable and relevant to the broader streetwear market.
- 2026-10-08 · initial brief · Target customer: younger customers who follow fashion, music, social media and sneaker culture.
- 2026-10-08 · initial brief · Visual identity: dark, oversized, heavyweight streetwear. Colors: black, washed black, charcoal, washed gray, silver, off-white; accents burgundy, muted olive, icy blue. Gothic-inspired type, original cross and star motifs, rhinestone and crystal details, embroidery, woven labels.
- 2026-10-08 · initial brief · First collection is called DROP 001. Candidate products: signature hoodie, statement hoodie, oversized graphic tee, baggy sweatpants, baggy jeans, beanie. Founder's starting recommendation is hoodie, tee and sweatpants, pending validation.
- 2026-10-08 · initial brief · Decoration tiers: Core (restrained), Statement/Signature (larger graphics, more crystals), Special Edition (elaborate, smaller runs, higher price).
- 2026-10-08 · initial brief · Goal: a real online store that can take customer orders, plus hang tags, neck labels, care labels and packaging.
- 2026-10-08 · initial brief · Budget is a "small startup budget" (no number given). No supplier quotes, confirmed prices, production quantity, domain or launch date exist yet.
- 2026-10-08 · initial brief · No audience, email list or social following has been mentioned. LSW trademark and commercial availability have not been checked.
- 2026-10-09 · build · The LSW storefront on main (app/(store), lib/catalog.ts) has 4 products: Signature Heavyweight Hoodie $125, Oversized Graphic Tee $55, Embroidered Beanie $35 (all draft prices), and a Statement Hoodie concept ($210 draft, not purchasable). Images are concept renders. (The earlier preview site on this branch, with $120/$55/$90 drafts, was superseded by it.)
- 2026-10-09 · build · Stripe Checkout, a signed idempotent webhook, Upstash Redis inventory with atomic reservations, automatic refunds for oversold late payments, order records with shipping and fulfilment status, and reconcile/fulfil tools are implemented (lib/commerce, docs/CHECKOUT.md); 103 automated tests pass locally against a real Redis. Not yet tested against real Stripe or Upstash accounts; no keys have been added. Live payments are blocked unless ALLOW_LIVE_PAYMENTS=true and the store is in live mode.
