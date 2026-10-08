# Tags, labels & packaging — concepts and production notes

Visual concepts are on `/brand`. Sizes are starting points; confirm with your printer/manufacturer. **⚠ = must come from the manufacturer or counsel — do not guess.**

| Item | Concept | Size | Material / finish | Notes |
|---|---|---|---|---|
| Hang tag (front) | Black; symbol + wordmark in silver foil; "DROP 001" small | 50 × 90 mm | 450–600 gsm black uncoated board, silver foil + blind deboss | Black waxed cord or loop |
| Hang tag (back) | FAITH / DISCIPLINE / PURPOSE, one supporting line, optional Scripture reference, **QR** | same | Silver foil or silver ink | QR → official store URL **only once the domain is final**; test-scan every printed QR |
| Inside neck label | Wordmark + size, black woven, silver thread | ~40 × 60 mm | Damask woven, soft heat-cut edge | Tagless heat-transfer is a comfort alternative |
| Care label ⚠ | Blank fields: fiber content, wash instructions, country of origin, manufacturer/importer identification | ~30 × 70 mm | Satin sewn-in | US labelling (FTC care/fiber/origin, RN/CA numbers) — verify with manufacturer |
| Limited-edition label | "LSW / DROP 001 / LIMITED EDITION" | ~35 × 35 mm | Woven or printed | **Number only if production is counted and tracked** |
| Mailer | Black matte, silver one-colour symbol | ~35 × 28 cm | Recycled poly or paper mailer | Custom print needs high minimums — start with stock black + sticker |
| Tissue | Black tissue, repeat symbol in silver | 50 × 75 cm | 17–20 gsm acid-free | Fold crystal panels inward |
| Seal / sticker | Silver symbol on black | 40 mm round | Matte paper/vinyl | Cheapest brand moment — start here |
| Thank-you card | "Wear your purpose." + early-access QR | 90 × 55 mm | 350 gsm black, silver foil/white ink | |
| Product info card | Fit, care, **crystal-care** instructions | 90 × 55 mm | 350 gsm | Crystal care is the likeliest support topic |

**Start-up approach:** first drop = stock black mailer + printed stickers + hang tags + thank-you card. Add custom mailers/tissue at drop 002 when volume justifies minimums.

## Print-ready files (`public/brand/tags/`)
Generated from `scripts/build-brand-assets.ts`; 1 SVG unit = 1 mm, so each file prints at its stated size. These are layout proofs for the printer, not final production artwork. Foil, embossing and woven construction need the manufacturer's files.

| File | Size | Notes |
|---|---|---|
| `hang-tag-front-50x90mm.svg` | 50 × 90 mm | Black, symbol and wordmark in silver, "DROP 001". Foil and deboss to be specified by the printer. |
| `hang-tag-reverse-50x90mm.svg` | 50 × 90 mm | FAITH / DISCIPLINE / PURPOSE. QR is a placeholder box, not a code. Add the real code only once the store URL is live and tested. |
| `neck-label-woven-40x60mm.svg` | 40 × 60 mm | `[SIZE]` is a placeholder to set per garment. |
| `care-label-40x70mm.svg` | 40 × 70 mm | Fields intentionally blank. Fill only with manufacturer-confirmed content. |
| `limited-label-35x35mm.svg` | 35 × 35 mm | `PIECE ___ / ___` stays blank until a tracked numbered run exists. |
