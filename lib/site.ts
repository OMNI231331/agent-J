export const site = {
  name: "LSW",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Provided by the founder. Override with NEXT_PUBLIC_CONTACT_EMAIL (e.g. a branded address later). */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "caleb.bowland@fwcsstudents.org",
  /** Add real handles in env once accounts exist. Nothing is invented. */
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? null,
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? null,
  },
  /** "preview" = pre-launch (banner shown, draft data). "live" = real store. */
  mode: (process.env.NEXT_PUBLIC_STORE_MODE === "live" ? "live" : "preview") as "preview" | "live",
  /** Public opening of DROP 001: a full ISO time with timezone, set ONLY when confirmed. Parsed and enforced in lib/drop.ts. */
  launchDate: process.env.NEXT_PUBLIC_LAUNCH_DATE ?? null,
  /**
   * One-line shipping and returns terms shown on product pages and in the bag BEFORE checkout
   * (surprise costs are the top fixable reason carts are abandoned). Null until decided: the UI then says
   * the exact cost is shown at checkout, before payment, and never invents a rate.
   */
  shippingSummary: process.env.NEXT_PUBLIC_SHIPPING_SUMMARY || null,
  returnsSummary: process.env.NEXT_PUBLIC_RETURNS_SUMMARY || null,
};
