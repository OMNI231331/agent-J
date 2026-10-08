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
