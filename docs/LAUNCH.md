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
| Payments | Stripe Checkout + signed webhook + atomic Redis inventory are implemented and tested against test doubles (`docs/CHECKOUT.md`). **Not yet verified against real Stripe/Upstash.** | Follow `docs/CHECKOUT.md` steps 1–5 in **test mode** first. Live keys stay refused until `ALLOW_LIVE_PAYMENTS=true` and `NEXT_PUBLIC_STORE_MODE=live`. |
| Order confirmation | Success page shows real order status; Stripe emails the receipt once enabled in Stripe settings. No order-admin UI (use `pnpm inventory orders`). `needs_attention` orders need a manual refund. | Enable Stripe customer receipts; decide on order emails/admin later. |
| Inventory | Upstash Redis per size×color SKU, reserved atomically. Catalog `stock` is a demo seed only. | Create Upstash DB, add env vars, set real counts with `pnpm inventory` (`docs/CHECKOUT.md`). |
| Release clock & early access | Implemented and tested: one fixed release time, enforced by `/api/checkout` (403 before it); a countdown that never resets; signed early-access links (`pnpm early-access`) that unlock checkout for list members from `DROP_EARLY_ACCESS_AT`, max 4 checkout starts per link. **Off until you set a date.** | Pick the date/time, set `NEXT_PUBLIC_LAUNCH_DATE` (full time + zone), `DROP_EARLY_ACCESS_AT`, `EARLY_ACCESS_SECRET` in Vercel, **redeploy**, then email each subscriber their link (see below) |
| Shipping/returns line | Product page + bag show `NEXT_PUBLIC_SHIPPING_SUMMARY` / `NEXT_PUBLIC_RETURNS_SUMMARY` before checkout; until set they say the exact cost appears at checkout | Decide rates + policy, set both, and make the Stripe shipping rate match |
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

## Running the DROP 001 release
1. Decide the public time, e.g. Friday 5:00 PM Eastern. In Vercel set `NEXT_PUBLIC_LAUNCH_DATE=2026-11-20T17:00:00-05:00` (always include the time and zone; a bare date is ignored), `DROP_EARLY_ACCESS_AT` (e.g. 24 h earlier) and `EARLY_ACCESS_SECRET` (`openssl rand -hex 32`). Redeploy — `NEXT_PUBLIC_*` values are baked in at build time.
2. Export the Resend audience to `subscribers.txt`, then `pnpm early-access --file subscribers.txt > links.csv` (needs the same three values plus `NEXT_PUBLIC_SITE_URL` in `.env.local`). Each row is `email,link`.
3. Email each subscriber their own link before the early window opens. A link sets a cookie on that device and allows 4 checkout starts; it stops mattering at public opening.
4. At the public time the countdown hits zero, pages refresh, and checkout opens for everyone. Nothing about the clock can be moved by a visitor.

Never extend or restart the clock after announcing it. If the date must move, change the env value, redeploy, and tell the list plainly.
