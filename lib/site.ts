export const site = {
  name: "LSW",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Only shown when configured — we never invent contact details. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
  /** Add real handles in env once accounts exist. Nothing is invented. */
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? null,
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? null,
  },
  /** "preview" = pre-launch (banner shown, draft data). "live" = real store. */
  mode: (process.env.NEXT_PUBLIC_STORE_MODE === "live" ? "live" : "preview") as "preview" | "live",
  /** Set to an ISO date ONLY when a launch date is confirmed. */
  launchDate: process.env.NEXT_PUBLIC_LAUNCH_DATE ?? null,
};
