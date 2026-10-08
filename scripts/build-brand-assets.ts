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
