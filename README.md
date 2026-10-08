# LSW — Premium limited-edition streetwear

Next.js 16 / React 19 / Tailwind 4 storefront for **LSW**, plus the existing eve assistant at `/assistant`.

- **Storefront:** `app/(store)/` · components `components/store/` · data `lib/catalog.ts` · cart `lib/cart.tsx` · inventory rules `lib/inventory.ts`
- **APIs:** `app/api/checkout` (Stripe Checkout), `app/api/subscribe` (Resend Audience)
- **Logo system:** `lib/brand.ts` → `public/brand/*.svg` via `scripts/build-brand-assets.ts`; reference page `/brand`
- **Docs:** `docs/BRAND.md`, `PACKAGING.md`, `BUSINESS.md`, `LAUNCH.md` (setup + what's still required), `ASSETS.md`

Start with **`docs/LAUNCH.md`**. The store is not yet configured to take real payments.
