# Setup & launch checklist

## Run locally
```bash
pnpm install
cp .env.example .env.local   # storefront vars are all optional; the eve assistant needs its own
pnpm dev                     # http://localhost:3000   (assistant: /assistant)
pnpm typecheck
pnpm build                   # needs BETTER_AUTH_SECRET, VERCEL_APP_CLIENT_ID/SECRET, VERCEL_URL (existing eve assistant auth)
```
Regenerate logo files: `node scripts/build-brand-assets.ts` (Node ≥ 22.18).

## Tested today (Chromium, 390px mobile)
Mobile menu navigation · shop filter/sort · color/size selection (unavailable variants disabled, size reset when color changes) · add to bag, quantity ±, per-line limit, remove, subtotal, persistence across reload, empty state · newsletter validation and honest error states · checkout error state · concept product not purchasable · no horizontal overflow on key pages · `tsc` and `next build` pass. **Not tested:** real payments, real email delivery, screen readers, Safari/iOS, Lighthouse.

## Not live until configured
| Item | State | To do |
|---|---|---|
| Payments | `/api/checkout` creates Stripe Checkout sessions, re-pricing and re-checking stock server-side; clean 503 without a key | Stripe account → `STRIPE_SECRET_KEY` (**`sk_test_` = test mode**, `sk_live_` = real charges), shipping rate id, Stripe Tax. Live keys are refused while `INVENTORY_SOURCE = "demo"` |
| Order confirmation / stock decrement | Success page only; **no webhook yet** | Stripe webhook (`checkout.session.completed`) → decrement stock, send confirmation. Required before selling real limited stock |
| Inventory | Demo numbers in `lib/catalog.ts`; counts never shown | Real counts; set `INVENTORY_SOURCE = "live"` |
| Email sign-up | `/api/subscribe` → Resend Audience; 503 (and a visible message) without config | `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, verified sending domain, unsubscribe flow |
| Prices | **Not decided yet** — $125/$55/$35 are placeholders shown as "Draft price". With `NEXT_PUBLIC_STORE_MODE=live` the store refuses to sell any product whose pricing isn't `"confirmed"` | Cost out with real quotes (`docs/BUSINESS.md`), set prices, mark `pricing: "confirmed"` |
| Specs | Fabric/GSM/composition/measurements/care are unconfirmed targets (UI says so) | Fill after samples; size guide table |
| Imagery | Labelled vector concept renders | Photography → `docs/ASSETS.md` |
| Policies | Shipping/returns, privacy, terms are drafts | Write + legal review |
| Contact | Set to caleb.bowland@fwcsstudents.org (founder-provided; a school-issued address may be deactivated or controlled by the school — move to a brand-owned address with your domain when possible, via `NEXT_PUBLIC_CONTACT_EMAIL`) | — |
| Socials | Hidden until env set | Create accounts, then set `NEXT_PUBLIC_*` |
| Domain, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STORE_MODE=live` | Not set | Domain + Vercel env |
| Business/legal | Not done | Trademark search, care/origin labelling, sales-tax registration, business license, insurance |

**Do not take real orders until every row is resolved.** This is a launch-ready front end and integration scaffold, not yet a production store.
