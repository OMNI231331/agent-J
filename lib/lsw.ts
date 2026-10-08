// Single source of truth for LSW brand + product data.
// Everything marked "draft" is a placeholder until it is confirmed with a supplier or by the founder.

export const brand = {
  name: "LSW",
  tagline: "More than clothing. It's a reminder.",
  pillars: ["Faith", "Discipline", "Purpose"],
  // Replace with the real address before launch; shown on the contact page.
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
};

export type ColorOption = { id: string; name: string; hex: string };
export type GarmentKind = "hoodie" | "tee" | "pants";
export type Tier = "Core" | "Signature" | "Special Edition";

export type Product = {
  slug: string;
  name: string;
  kind: GarmentKind;
  tier: Tier;
  tagline: string;
  description: string;
  /** USD. A draft price until the cost model is verified with supplier quotes. */
  price: number;
  colors: ColorOption[];
  sizes: string[];
  /** Variants permanently withdrawn from sale, as `${colorId}:${size}`. Live stock comes from Redis, not from here. */
  unavailable: string[];
  fit: string;
  /** Target specs, NOT confirmed. Replace with the manufacturer's real specs. */
  fabricDraft: string;
  careDraft: string;
  decoration: string[];
  details: string[];
};

export const colors: Record<string, ColorOption> = {
  "washed-black": { id: "washed-black", name: "Washed Black", hex: "#1c1c1f" },
  charcoal: { id: "charcoal", name: "Charcoal", hex: "#37383c" },
  "washed-gray": { id: "washed-gray", name: "Washed Gray", hex: "#6a6b70" },
  cream: { id: "cream", name: "Off-White", hex: "#e6e1d6" },
};

const standardSizes = ["S", "M", "L", "XL", "XXL"];

export const products: Product[] = [
  {
    slug: "signature-hoodie",
    name: "Signature Heavyweight Hoodie",
    kind: "hoodie",
    tier: "Signature",
    tagline: "The piece that carries the brand.",
    description:
      "An oversized heavyweight hoodie with a restrained front logo and one large back graphic: an original LSW cross outlined in crystal. One statement, not five.",
    price: 120,
    colors: [colors["washed-black"], colors.charcoal],
    sizes: standardSizes,
    unavailable: [],
    fit: "Oversized, dropped shoulder. Size guide to be confirmed from the first sample.",
    fabricDraft: "Target: heavyweight cotton fleece, roughly 450-500gsm, garment washed. Unconfirmed.",
    careDraft: "Draft: machine wash cold inside out, do not tumble dry the embellished areas. Confirm with the manufacturer.",
    decoration: [
      "Front chest: small embroidered or woven LSW mark",
      "Back: large original cross, outlined in silver and clear rhinestones",
      "Sleeve: simple screen-printed text, no stones",
    ],
    details: ["Interior woven neck label", "Numbered edition label only if we actually number the run", "Ribbed cuffs and hem"],
  },
  {
    slug: "oversized-tee",
    name: "Oversized Graphic Tee",
    kind: "tee",
    tier: "Core",
    tagline: "The entry point to LSW.",
    description:
      "A relaxed, heavyweight tee with a small chest mark and a clean screen-printed back graphic. The most accessible way into the collection, and the easiest to produce well.",
    price: 55,
    colors: [colors["washed-black"], colors["washed-gray"], colors.cream],
    sizes: standardSizes,
    unavailable: [],
    fit: "Oversized, boxy. Size guide to be confirmed from the first sample.",
    fabricDraft: "Target: heavyweight cotton jersey, roughly 280-320gsm, garment dyed or washed. Unconfirmed.",
    careDraft: "Draft: machine wash cold inside out, hang dry. Confirm with the manufacturer.",
    decoration: ["Front chest: small LSW mark", "Back: large screen-printed cross and wordmark (no rhinestones, to keep cost and weight down)"],
    details: ["Interior woven or printed neck label", "Reinforced collar"],
  },
  {
    slug: "baggy-sweatpants",
    name: "Baggy Sweatpants",
    kind: "pants",
    tier: "Core",
    tagline: "Matches the hoodie without repeating it.",
    description:
      "Wide, relaxed sweatpants in the same fabric family as the hoodie. One embroidered detail down the leg and a small crystal star, and nothing else.",
    price: 90,
    colors: [colors.charcoal, colors["washed-black"]],
    sizes: standardSizes,
    unavailable: [],
    fit: "Baggy through the leg. Size guide to be confirmed from the first sample.",
    fabricDraft: "Target: heavyweight cotton fleece, roughly 400-450gsm. Unconfirmed.",
    careDraft: "Draft: machine wash cold inside out. Confirm with the manufacturer.",
    decoration: ["Left leg: embroidered LSW lettering", "One small rhinestone star near the hem"],
    details: ["Elastic waistband with drawcord", "Side pockets", "Optional metal drawcord tips"],
  },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const variantKey = (colorId: string, size: string) => `${colorId}:${size}`;
export const isVariantAvailable = (p: Product, colorId: string, size: string) => !p.unavailable.includes(variantKey(colorId, size));
export const formatPrice = (n: number) => `$${n.toFixed(2)}`;
