/**
 * LSW logo geometry — single source of truth.
 * Every SVG (site components + /public/brand files) is generated from these points,
 * so the logo stays identical everywhere. Original construction, not derived from any font.
 */
export type Pt = readonly [number, number];

export const WORDMARK_VIEWBOX = { w: 330, h: 100 } as const;

export const WORDMARK_GLYPHS: Record<"L" | "S" | "W", Pt[]> = {
  L: [[6, 4], [46, 4], [46, 68], [92, 68], [106, 96], [6, 96], [22, 80], [22, 20]],
  S: [[138, 4], [198, 4], [198, 24], [146, 24], [146, 38], [184, 38], [198, 52], [198, 82], [184, 96], [126, 96], [114, 84], [114, 76], [178, 76], [178, 62], [140, 62], [126, 48], [126, 16]],
  W: [[206, 4], [234, 4], [244, 62], [258, 14], [274, 14], [288, 62], [298, 4], [326, 4], [306, 96], [282, 96], [266, 48], [250, 96], [226, 96]],
};

export const MONOGRAM_VIEWBOX = { w: 100, h: 100 } as const;

/** Spiked cross. Vertical blade + crossbar, with a diamond cut-out at the crossing. */
export const MONOGRAM_BLADES: Pt[][] = [
  [[50, 2], [58, 34], [58, 92], [50, 98], [42, 92], [42, 34]],
  [[6, 42], [34, 35], [66, 35], [94, 42], [66, 49], [34, 49]],
];
export const MONOGRAM_CUTOUT: Pt[] = [[50, 34], [55, 42], [50, 50], [45, 42]];

export const toPath = (pts: readonly Pt[]) =>
  `M${pts.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

export const WORDMARK_PATH = Object.values(WORDMARK_GLYPHS).map(toPath).join(" ");
export const MONOGRAM_PATH = [...MONOGRAM_BLADES, MONOGRAM_CUTOUT].map(toPath).join(" ");

/** Evenly spaced points along a closed polygon outline (used for rhinestone layouts). */
export function sampleOutline(pts: readonly Pt[], spacing: number, inset = 0): Pt[] {
  const out: Pt[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    let d = carry;
    while (d < len) {
      out.push([x1 + ux * d + uy * inset, y1 + uy * d - ux * inset]);
      d += spacing;
    }
    carry = d - len;
  }
  return out;
}
