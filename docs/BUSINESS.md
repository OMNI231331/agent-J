# Pricing, cost & launch framework

**All numbers are placeholders to structure your thinking. Replace with real quotes before relying on them. Nothing here is a supplier quote.**

## Unit-economics worksheet (fill from quotes)
| Cost line | Hoodie | Tee | Beanie | Source |
|---|---|---|---|---|
| Blank / cut-and-sew garment | ? | ? | ? | Manufacturer quote |
| Embroidery | ? | ? | ? | Decorator (stitch count) |
| Print | – | ? | – | Printer |
| Rhinestone transfer | ? | – | – | Decorator |
| Labels + tags | ? | ? | ? | Trim supplier |
| Packaging | ? | ? | ? | |
| Inbound freight / duty | ? | ? | ? | |
| **Landed cost (L)** | | | | |
| Then subtract: payment fees (~3% + 30¢ typical), shipping subsidy, returns allowance, marketing cost per order | | | | |

**Pricing:** DTC fashion commonly targets retail of roughly 2.5–4× landed cost to cover fees, returns, shipping and marketing. The draft site prices ($125 / $55 / $35) are hypotheses, not validated. Compute gross margin = (price − L) / price, then contribution margin after fees/shipping/returns/ad spend; aim for a healthy positive number before ordering.

## Quantities & risk
- Sampling: budget 2–3 rounds for the hoodie. Samples decide fabric weight, crystal durability and fit.
- Minimum order quantities vary widely by supplier and are per style/color — get them in writing.
- Start small, sized to demand you can see (sign-ups, pre-orders), not hope. A clearly-labelled pre-order window with a stated ship window is a valid way to size a run.
- Don't claim "limited to N" until N is the real production count.

## Validating demand
1. Teaser content + early-access list. 2. Show samples; ask which piece people would buy; track saves/shares/replies. 3. Pre-order the hoodie; produce sold units plus a small buffer. 4. After launch: survey buyers (fit, quality, price), log return reasons, feed into drop 002.

## Launch sequence (no dates promised)
Teasers (symbol, texture macros) → sample reveal / behind the scenes → lookbook → early-access email (list first) → launch → shipping updates + customer content → feedback and restock decision. Short-form video (setting crystals, pressing transfers, unboxing) suits this aesthetic. This improves odds; it does not guarantee sell-through.

## Inventory recommendation
Phase 1: the catalog file (`lib/catalog.ts`) + a Stripe webhook decrementing counts in a small store (e.g. Upstash Redis) — enough for ≲10 SKUs per drop. Phase 2: Shopify or a headless commerce backend if you add a 3PL, returns tooling, discounts or multiple channels. The single decision point is `variantAvailability()` in `lib/inventory.ts`.
