/**
 * LSW product catalog — typed source of truth for the storefront.
 *
 * STATUS: everything marked `draft` is a design target, NOT a verified spec.
 * Prices are placeholders until supplier quotes exist; stock is demo data until
 * real production counts exist (see docs/LAUNCH.md). Nothing here is a claim of
 * manufactured product.
 */
export type ColorId = "black" | "washed-black" | "charcoal" | "washed-gray";
export type Garment = "hoodie" | "statement-hoodie" | "tee" | "beanie";
export type Category = "Hoodies" | "Tees" | "Headwear";
export type DecorationLevel = 1 | 2 | 3;

export const COLORS: Record<ColorId, { name: string; hex: string }> = {
  black: { name: "Black", hex: "#0e0e10" },
  "washed-black": { name: "Washed Black", hex: "#242528" },
  charcoal: { name: "Charcoal", hex: "#3a3c41" },
  "washed-gray": { name: "Washed Gray", hex: "#7a7d83" },
};

export type Variant = { sku: string; color: ColorId; size: string; stock: number | null };

export type Product = {
  slug: string;
  name: string;
  garment: Garment;
  category: Category;
  tagline: string;
  /** Integer cents. */
  priceCents: number;
  /** "draft" until a real cost/margin exercise and supplier quote confirm it. */
  pricing: "draft" | "confirmed";
  /** false = concept only: shown on site, cannot be added to cart. */
  purchasable: boolean;
  level: DecorationLevel;
  description: string;
  fit: string;
  fabric: { summary: string; composition: string | null };
  details: string[];
  care: string[];
  sizes: string[];
  colors: ColorId[];
  variants: Variant[];
  /** Real photography, once it exists. Concept renders are used when empty. */
  photos?: { src: string; alt: string; kind: "front" | "back" | "detail" | "model" }[];
  sizeGuide: { note: string; rows: { size: string; chest?: string; length?: string; sleeve?: string }[] };
};

/** "demo" = placeholder numbers. Switch to "live" only after wiring real inventory. */
export const INVENTORY_SOURCE: "demo" | "live" = "demo";

const SIZES_APPAREL = ["S", "M", "L", "XL", "XXL"];

function variants(prefix: string, colors: ColorId[], sizes: string[], overrides: Record<string, number | null> = {}): Variant[] {
  return colors.flatMap((color) =>
    sizes.map((size) => {
      const sku = `${prefix}-${color}-${size}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      const key = `${color}/${size}`;
      return { sku, color, size, stock: key in overrides ? overrides[key] : 20 };
    }),
  );
}

const guide = (note: string) => ({
  note,
  rows: SIZES_APPAREL.map((size) => ({ size })),
});

const CARE_DRAFT = [
  "Care instructions are provisional until the fabric and decoration are confirmed.",
  "Intended: turn inside out, wash cold, no bleach, hang dry — protects prints and crystals.",
];

export const products: Product[] = [
  {
    slug: "signature-hoodie",
    name: "Signature Heavyweight Hoodie",
    garment: "hoodie",
    category: "Hoodies",
    tagline: "Quiet front. Loud back.",
    priceCents: 12500,
    pricing: "draft",
    purchasable: true,
    level: 2,
    description:
      "The piece the whole drop is built around. A small controlled mark on the chest, a large spiked-cross graphic across the back outlined in clear crystals, and a sleeve detail you only notice up close.",
    fit: "Oversized, dropped shoulder. Intended to be worn in your true size for the designed fit.",
    fabric: {
      summary: "Heavyweight brushed-back cotton fleece, target 400–450 GSM (design target — unconfirmed).",
      composition: null,
    },
    details: [
      "Small LSW wordmark, front chest — embroidered (target ~7 cm wide)",
      "Back: large cross graphic, crystal-outlined (target ~28 × 34 cm)",
      "Left sleeve: LSW monogram, crystal (target ~6 cm)",
      "Interior woven neck label, limited-edition label (DROP 001)",
      "Ribbed cuffs and hem, double-layer hood",
    ],
    care: CARE_DRAFT,
    sizes: SIZES_APPAREL,
    colors: ["washed-black", "charcoal"],
    variants: variants("LSW001-HOOD", ["washed-black", "charcoal"], SIZES_APPAREL, { "charcoal/XXL": 0 }),
    sizeGuide: guide("Measurements will be published from the approved production sample. Not yet verified."),
  },
  {
    slug: "oversized-graphic-tee",
    name: "Oversized Graphic Tee",
    garment: "tee",
    category: "Tees",
    tagline: "The accessible entry point.",
    priceCents: 5500,
    pricing: "draft",
    purchasable: true,
    level: 1,
    description:
      "A relaxed, boxy heavyweight tee with a restrained front mark and a vintage-treated back print. No crystals on this one — the lowest-risk, lowest-price way into LSW.",
    fit: "Oversized and boxy with a dropped shoulder. True size for the designed fit.",
    fabric: {
      summary: "Heavyweight cotton jersey, target 220–260 GSM (design target — unconfirmed).",
      composition: null,
    },
    details: [
      "Front left chest: small LSW mark — screen print or embroidery (to be confirmed at sampling)",
      "Back: cross + FAITH / DISCIPLINE / PURPOSE, vintage-distressed print (target ~30 cm wide)",
      "Garment-washed finish for a lived-in look",
      "Interior printed or woven neck label",
    ],
    care: CARE_DRAFT,
    sizes: SIZES_APPAREL,
    colors: ["washed-black", "washed-gray"],
    variants: variants("LSW001-TEE", ["washed-black", "washed-gray"], SIZES_APPAREL),
    sizeGuide: guide("Measurements will be published from the approved production sample. Not yet verified."),
  },
  {
    slug: "embroidered-beanie",
    name: "Embroidered Beanie",
    garment: "beanie",
    category: "Headwear",
    tagline: "Small piece. Full signal.",
    priceCents: 3500,
    pricing: "draft",
    purchasable: true,
    level: 1,
    description:
      "A cuffed knit beanie with the LSW wordmark embroidered on the cuff. One size, low production risk, and the easiest first LSW piece to put on someone's head.",
    fit: "One size, cuffed. Stretch knit.",
    fabric: { summary: "Acrylic or cotton-blend rib knit — material to be selected at sampling (unconfirmed).", composition: null },
    details: ["Wordmark embroidered on cuff (target ~6 cm wide)", "Cuffed rib knit", "One size"],
    care: CARE_DRAFT,
    sizes: ["One size"],
    colors: ["black", "charcoal"],
    variants: variants("LSW001-BEAN", ["black", "charcoal"], ["One size"]),
    sizeGuide: { note: "One size. Circumference and stretch to be confirmed from the sample.", rows: [{ size: "One size" }] },
  },
  {
    slug: "statement-hoodie",
    name: "Statement Hoodie — Special Edition",
    garment: "statement-hoodie",
    category: "Hoodies",
    tagline: "Level 3. Concept only.",
    priceCents: 21000,
    pricing: "draft",
    purchasable: false,
    level: 3,
    description:
      "The most embellished expression of the drop: a full crystal-set back piece and detailed sleeves. It is a concept — it will only be produced if the Signature Hoodie proves demand and a sample passes comfort and durability checks.",
    fit: "Oversized, dropped shoulder.",
    fabric: { summary: "Same heavyweight fleece as the Signature Hoodie (unconfirmed).", composition: null },
    details: ["Full back crystal piece with outline and fill", "Sleeve crystal detailing", "Numbered label only if a tracked numbered run is produced"],
    care: CARE_DRAFT,
    sizes: SIZES_APPAREL,
    colors: ["black"],
    variants: variants("LSW001-STMT", ["black"], SIZES_APPAREL, Object.fromEntries(SIZES_APPAREL.map((s) => [`black/${s}`, null]))),
    sizeGuide: guide("Concept only — no measurements yet."),
  },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const dropProducts = products;
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
