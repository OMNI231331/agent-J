// Generates /public/brand/*.svg from lib/brand.ts. Run: node scripts/build-brand-assets.ts
import { mkdirSync, writeFileSync } from "node:fs";
import {
  MONOGRAM_BLADES, MONOGRAM_CUTOUT, MONOGRAM_PATH, MONOGRAM_VIEWBOX,
  WORDMARK_GLYPHS, WORDMARK_PATH, WORDMARK_VIEWBOX, sampleOutline, toPath,
} from "../lib/brand.ts";

const dir = new URL("../public/brand/", import.meta.url);
mkdirSync(dir, { recursive: true });
const W = WORDMARK_VIEWBOX, M = MONOGRAM_VIEWBOX;
const svg = (vb: string, body: string, title: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><title>${title}</title>${body}</svg>\n`;
const chrome = `<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f7"/><stop offset=".45" stop-color="#9ea1a8"/><stop offset=".55" stop-color="#e9ebee"/><stop offset="1" stop-color="#5d6066"/></linearGradient></defs>`;
const write = (name: string, s: string) => writeFileSync(new URL(name, dir), s);

// 1. Primary wordmark (chrome gradient, for dark backgrounds / web hero)
write("lsw-wordmark.svg", svg(`0 0 ${W.w} ${W.h}`, `${chrome}<path fill="url(#c)" fill-rule="evenodd" d="${WORDMARK_PATH}"/>`, "LSW"));
// 9. Monochrome (single colour, currentColor — site nav, packaging one-colour)
write("lsw-wordmark-mono.svg", svg(`0 0 ${W.w} ${W.h}`, `<path fill="currentColor" d="${WORDMARK_PATH}"/>`, "LSW"));
write("lsw-wordmark-mono-black.svg", svg(`0 0 ${W.w} ${W.h}`, `<path fill="#0a0a0b" d="${WORDMARK_PATH}"/>`, "LSW"));
write("lsw-wordmark-mono-offwhite.svg", svg(`0 0 ${W.w} ${W.h}`, `<path fill="#ece9e2" d="${WORDMARK_PATH}"/>`, "LSW"));
// 3. Monogram / symbol
write("lsw-monogram.svg", svg(`0 0 ${M.w} ${M.h}`, `${chrome}<path fill="url(#c)" fill-rule="evenodd" d="${MONOGRAM_PATH}"/>`, "LSW symbol"));
write("lsw-monogram-mono.svg", svg(`0 0 ${M.w} ${M.h}`, `<path fill="currentColor" fill-rule="evenodd" d="${MONOGRAM_PATH}"/>`, "LSW symbol"));
// 2/4. Secondary lockup: symbol + wordmark; small-size label version (heavier, no gradient)
write("lsw-lockup.svg", svg("0 0 460 100", `<g transform="translate(0 0)"><path fill="currentColor" fill-rule="evenodd" d="${MONOGRAM_PATH}"/></g><g transform="translate(130 0)"><path fill="currentColor" d="${WORDMARK_PATH}"/></g>`, "LSW lockup"));
write("lsw-label-small.svg", svg(`0 0 ${W.w} ${W.h}`, `<path fill="#ece9e2" stroke="#ece9e2" stroke-width="3" stroke-linejoin="miter" d="${WORDMARK_PATH}"/>`, "LSW"));
// 5. Large statement (back graphic): wordmark + monogram stacked, flat for screen print
write("lsw-back-statement.svg", svg("0 0 400 560", `<g transform="translate(100 0)"><path fill="#ece9e2" fill-rule="evenodd" d="${MONOGRAM_PATH}" transform="scale(2)"/></g><g transform="translate(35 230) scale(1)"><path fill="#ece9e2" d="${WORDMARK_PATH}" transform="scale(1)"/></g>`.replace('translate(35 230) scale(1)', 'translate(35 400) scale(1)'), "LSW back statement"));
// 6. Embroidery: solid shapes, min feature >= 1.5mm at 60mm width, no gradients (stitch-ready)
write("lsw-embroidery.svg", svg(`0 0 ${W.w} ${W.h}`, `<path fill="#c9ccd1" stroke="#c9ccd1" stroke-width="2" d="${WORDMARK_PATH}"/>`, "LSW embroidery"));
// 7. Screen print: one colour, solid fill, registration-safe
write("lsw-screenprint.svg", svg(`0 0 ${W.w} ${W.h}`, `<path fill="#000" d="${WORDMARK_PATH}"/>`, "LSW screen print 1-colour"));
// 8. Rhinestone: outline built from stones (spacing 7 units, ~4 units stone). Scale so stone = 3-4mm.
const stones = Object.values(WORDMARK_GLYPHS).flatMap((g) => sampleOutline(g, 7, 3));
write("lsw-rhinestone.svg", svg(`0 0 ${W.w} ${W.h}`, stones.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#e8eaee" stroke="#8d9096" stroke-width=".5"/>`).join(""), "LSW rhinestone layout"));
const mstones = [...MONOGRAM_BLADES].flatMap((g) => sampleOutline(g, 6, 2));
write("lsw-monogram-rhinestone.svg", svg(`0 0 ${M.w} ${M.h}`, mstones.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="#e8eaee" stroke="#8d9096" stroke-width=".4"/>`).join("") + `<path fill="none" stroke="none" d="${toPath(MONOGRAM_CUTOUT)}"/>`, "LSW symbol rhinestone layout"));
console.log("brand assets written");

// ---- Tags & labels (print/weave-ready layouts; blank fields are intentional) ----
// Sizes are in mm and the viewBox is 1 unit = 1 mm, so these scale exactly to print size.
const tagDir = new URL("../public/brand/tags/", import.meta.url);
mkdirSync(tagDir, { recursive: true });
const wr = (n: string, s: string) => writeFileSync(new URL(n, tagDir), s);
const W2 = (x: number) => x; // identity; keeps numbers readable below
const mark = (x: number, y: number, h: number, fill: string) =>
  `<g transform="translate(${W2(x)} ${y}) scale(${h / 100})"><path fill="${fill}" fill-rule="evenodd" d="${MONOGRAM_PATH}"/></g>`;
const word = (x: number, y: number, w: number, fill: string) =>
  `<path fill="${fill}" d="${WORDMARK_PATH}" transform="translate(${x} ${y}) scale(${w / WORDMARK_VIEWBOX.w})"/>`;

// A. Main hang tag, front: 50 x 90 mm, black, silver wordmark + symbol, "DROP 001" small
wr("hang-tag-front-50x90mm.svg", svg("0 0 50 90",
  `<rect width="50" height="90" fill="#0a0a0b"/><rect x="2.5" y="2.5" width="45" height="85" fill="none" stroke="#2a2b2f" stroke-width=".3"/>` +
  mark(20, 20, 10, "#c9ccd1") +
  word(9, 40, 32, "#c9ccd1") +
  `<text x="25" y="70" text-anchor="middle" font-family="monospace" font-size="2.6" letter-spacing=".6" fill="#92959b">DROP 001</text>` +
  `<circle cx="25" cy="8" r="1.6" fill="none" stroke="#c9ccd1" stroke-width=".3"/>`,
  "LSW main hang tag front, 50 x 90 mm, 1 unit = 1 mm"));

// B. Reverse: brand line only. QR intentionally omitted until the store URL is final.
wr("hang-tag-reverse-50x90mm.svg", svg("0 0 50 90",
  `<rect width="50" height="90" fill="#0a0a0b"/><rect x="2.5" y="2.5" width="45" height="85" fill="none" stroke="#2a2b2f" stroke-width=".3"/>` +
  `<text x="25" y="26" text-anchor="middle" font-family="monospace" font-size="3" letter-spacing="1" fill="#c9ccd1">FAITH</text>` +
  `<text x="25" y="32" text-anchor="middle" font-family="monospace" font-size="3" letter-spacing="1" fill="#c9ccd1">DISCIPLINE</text>` +
  `<text x="25" y="38" text-anchor="middle" font-family="monospace" font-size="3" letter-spacing="1" fill="#c9ccd1">PURPOSE</text>` +
  `<text x="25" y="56" text-anchor="middle" font-family="sans-serif" font-size="3" fill="#92959b">More than clothing.</text>` +
  `<text x="25" y="61" text-anchor="middle" font-family="sans-serif" font-size="3" fill="#92959b">It's a reminder.</text>` +
  `<rect x="18" y="72" width="14" height="14" fill="none" stroke="#2a2b2f" stroke-dasharray="1 1" stroke-width=".3"/>` +
  `<text x="25" y="84" text-anchor="middle" font-family="monospace" font-size="1.8" fill="#92959b">QR: add when store URL is live</text>`,
  "LSW hang tag reverse, 50 x 90 mm"));

// C. Woven neck label, 40 x 60 mm (size is a placeholder until sampling)
wr("neck-label-woven-40x60mm.svg", svg("0 0 40 60",
  `<rect width="40" height="60" fill="#0a0a0b"/>` +
  word(8, 14, 24, "#ece9e2") +
  `<text x="20" y="40" text-anchor="middle" font-family="monospace" font-size="3" letter-spacing="1" fill="#92959b">SIZE</text>` +
  `<text x="20" y="50" text-anchor="middle" font-family="sans-serif" font-size="6" fill="#ece9e2">[SIZE]</text>`,
  "LSW woven neck label, 40 x 60 mm; [SIZE] to be set per garment"));

// D. Care label: fields blank on purpose. Do not fill in until manufacturer confirms.
wr("care-label-40x70mm.svg", svg("0 0 40 70",
  `<rect width="40" height="70" fill="#ece9e2"/>` +
  [["FIBER CONTENT:", 12], ["WASH:", 24], ["DRY / IRON:", 36], ["MADE IN:", 48], ["MANUFACTURER / IMPORTER:", 60]]
    .map(([t, y]) => `<text x="3" y="${y}" font-family="monospace" font-size="${String(t).length > 18 ? 2.1 : 2.6}" fill="#0a0a0b">${t}</text><line x1="3" x2="37" y1="${Number(y) + 1.5}" y2="${Number(y) + 1.5}" stroke="#0a0a0b" stroke-width=".2"/>`)
    .join(""),
  "LSW care label, 40 x 70 mm, fields intentionally blank"));

// E. Limited-edition label: no number printed. PIECE __/__ is only filled once a tracked run exists.
wr("limited-label-35x35mm.svg", svg("0 0 35 35",
  `<rect width="35" height="35" fill="#0a0a0b" stroke="#2a2b2f" stroke-width=".3"/>` +
  word(8, 6, 19, "#c9ccd1") +
  `<text x="17.5" y="22" text-anchor="middle" font-family="monospace" font-size="2.6" letter-spacing=".6" fill="#c9ccd1">DROP 001</text>` +
  `<text x="17.5" y="26" text-anchor="middle" font-family="monospace" font-size="1.8" letter-spacing=".6" fill="#92959b">LIMITED EDITION</text>` +
  `<text x="17.5" y="31" text-anchor="middle" font-family="monospace" font-size="1.8" fill="#92959b">PIECE ___ / ___</text>`,
  "LSW limited-edition label, 35 x 35 mm; numbering only once a tracked run exists"));
console.log("tags & labels written");

// ---- Packaging (1 unit = 1 mm). Proofs for the printer; finishes noted in docs/PACKAGING.md ----
const packDir = new URL("../public/brand/packaging/", import.meta.url);
mkdirSync(packDir, { recursive: true });
const wp = (n: string, s: string) => writeFileSync(new URL(n, packDir), s);
const INK = "#0a0a0b", LINE = "#2a2b2f", STEEL = "#92959b", SILVER = "#c9ccd1", BONE = "#ece9e2";
const mono = (x: number, y: number, s: number, t: string, fill = SILVER, anchor = "middle", ls = 0.6) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="'Geist Mono', ui-monospace, monospace" font-size="${s}" letter-spacing="${ls}" fill="${fill}">${t}</text>`;
const sans = (x: number, y: number, s: number, t: string, fill = STEEL, anchor = "middle") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Geist, Arial, sans-serif" font-size="${s}" fill="${fill}">${t}</text>`;
const qrSlot = (x: number, y: number, size: number, label: string) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="${LINE}" stroke-dasharray="1 1" stroke-width=".3"/>` +
  mono(x + size / 2, y + size / 2 + 0.6, 1.6, "QR", STEEL) + mono(x + size / 2, y + size + 3, 1.5, label, STEEL, "middle", 0.2);

// F. Seal sticker, 40 mm round: symbol centred, pillars set on a circular path.
wp("seal-sticker-40mm.svg", svg("0 0 40 40",
  `<defs><path id="ring" d="M20 20 m-14 0 a14 14 0 1 1 28 0 a14 14 0 1 1 -28 0"/></defs>` +
  `<circle cx="20" cy="20" r="20" fill="${INK}"/><circle cx="20" cy="20" r="18.6" fill="none" stroke="${SILVER}" stroke-width=".25"/>` +
  `<circle cx="20" cy="20" r="10.2" fill="none" stroke="${LINE}" stroke-width=".25"/>` +
  mark(15, 15, 10, SILVER) +
  `<text font-family="'Geist Mono', ui-monospace, monospace" font-size="2.2" fill="${SILVER}"><textPath href="#ring" startOffset="0" textLength="86" lengthAdjust="spacing">FAITH · DISCIPLINE · PURPOSE · LSW ·</textPath></text>`,
  "LSW seal sticker, 40 mm round, 1 unit = 1 mm. Die-cut line = outer circle"));

// G. Thank-you card, 90 x 55 mm, front and back.
wp("thank-you-card-front-90x55mm.svg", svg("0 0 90 55",
  `<rect width="90" height="55" fill="${INK}"/>` + mark(39, 11, 12, SILVER) +
  mono(45, 34, 2.8, "WEAR YOUR PURPOSE.", BONE, "middle", 1.1) + mono(45, 47, 1.7, "LSW · DROP 001", STEEL, "middle", 0.8),
  "LSW thank-you card front, 90 x 55 mm"));
wp("thank-you-card-back-90x55mm.svg", svg("0 0 90 55",
  `<rect width="90" height="55" fill="${INK}"/><rect x="3" y="3" width="84" height="49" fill="none" stroke="${LINE}" stroke-width=".25"/>` +
  word(8, 9, 18, SILVER) +
  sans(8, 22, 2.6, "Thank you for wearing LSW.", BONE, "start") +
  sans(8, 27, 2.1, "This piece was made in a limited run, on purpose.", STEEL, "start") +
  sans(8, 31, 2.1, "Same mission. Different day.", STEEL, "start") +
  mono(8, 45, 1.8, "FAITH / DISCIPLINE / PURPOSE", SILVER, "start", 0.5) +
  qrSlot(68, 22, 14, "next drop list"),
  "LSW thank-you card back, 90 x 55 mm. QR slot: add only once the URL is live and test-scanned"));

// H. Product info card, 90 x 55 mm: fit + crystal care. Garment-specific fabric lines stay blank until confirmed.
wp("product-info-card-90x55mm.svg", svg("0 0 90 55",
  `<rect width="90" height="55" fill="${BONE}"/>` +
  `<path fill="${INK}" d="${WORDMARK_PATH}" transform="translate(6 6) scale(${14 / WORDMARK_VIEWBOX.w})"/>` +
  mono(84, 9.5, 1.7, "PRODUCT CARE", INK, "end", 0.6) +
  `<line x1="6" x2="84" y1="14" y2="14" stroke="${INK}" stroke-width=".2"/>` +
  mono(6, 19, 1.7, "PIECE", INK, "start", 0.4) + `<line x1="20" x2="84" y1="19.4" y2="19.4" stroke="${INK}" stroke-width=".15"/>` +
  mono(6, 24, 1.7, "FABRIC", INK, "start", 0.4) + `<line x1="20" x2="84" y1="24.4" y2="24.4" stroke="${INK}" stroke-width=".15"/>` +
  mono(6, 30.5, 1.7, "CRYSTAL CARE", INK, "start", 0.4) +
  [
    "Turn inside out. Wash cold on a gentle cycle.",
    "Hang dry. No tumble dryer, no bleach.",
    "Never iron over stones or prints.",
    "A loose stone? Contact us — we'd rather fix it.",
  ].map((t, i) => sans(6, 35 + i * 3.6, 2, t, "#3a3c41", "start")).join("") +
  mono(84, 51, 1.4, "CONFIRM WASH STEPS AGAINST THE CARE LABEL", "#7a7d83", "end", 0.2),
  "LSW product info card, 90 x 55 mm. PIECE and FABRIC filled per garment from confirmed specs"));

// I. Tissue repeat tile, 60 x 60 mm: half-drop repeat (marks sit inside the tile, so it tiles seamlessly).
// The printer repeats it across 500 x 750 mm sheets.
wp("tissue-repeat-tile-60mm.svg", svg("0 0 60 60", `<rect width="60" height="60" fill="${INK}"/>` + mark(11, 11, 8, SILVER) + mark(41, 41, 8, SILVER), "LSW tissue repeat tile, 60 x 60 mm, seamless half-drop"));

// J. Mailer face, 350 x 280 mm: one-colour silver, quiet by design (theft-safe: no "premium inside" signals).
wp("mailer-front-350x280mm.svg", svg("0 0 350 280",
  `<rect width="350" height="280" fill="${INK}"/>` + mark(160, 104, 30, SILVER) +
  mono(175, 158, 5, "LSW", SILVER, "middle", 4) +
  mono(14, 268, 3, "RETURN ADDRESS: __________________", STEEL, "start", 0.6) +
  `<rect x="205" y="196" width="130" height="70" fill="none" stroke="${LINE}" stroke-dasharray="3 3" stroke-width=".6"/>` +
  mono(270, 233, 3, "SHIPPING LABEL", STEEL, "middle", 1.2),
  "LSW mailer face, 350 x 280 mm, one-colour silver on black"));
console.log("packaging written");
