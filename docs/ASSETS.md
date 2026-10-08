# Asset list & file naming

Naming: `{product-slug}__{color}__{view}.jpg` (e.g. `signature-hoodie__charcoal__back.jpg`), 4:5, ≥1600 px tall, sRGB, JPG/WebP. Put files in `public/photos/`, then add `photos: [{ src, alt, kind }]` to the product in `lib/catalog.ts`; product pages and cards then use photos instead of concept renders.

**Per product:** front · back · crystal/embroidery macro · interior label · on-model front/back (2–3 models/sizes) · fabric texture.
**Campaign:** 3–5 hero frames in concrete/industrial/studio settings (no mountains) · lookbook · packaging flat-lay · behind-the-scenes stills.
**Social:** teaser (symbol), reveal, "now live"; countdown only once a real date exists.
**Concept renders** (`components/store/garment-art.tsx`) are vector illustrations and stay labelled as concepts. AI mockups, if ever used, go in `public/concepts/`, separate from photography.
