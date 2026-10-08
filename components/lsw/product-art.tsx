import type { GarmentKind } from "@/lib/lsw";
import { CROSS_PATH, WORDMARK_PATHS } from "./logo";

export type ArtView = "front" | "back" | "detail";

const SHAPES: Record<GarmentKind, { body: string; extra?: string }> = {
  hoodie: {
    body: "M120,76 L150,56 C172,78 228,78 250,56 L282,76 L364,306 L320,324 L292,196 L294,436 L106,436 L108,196 L80,324 L36,306 Z",
    extra: "M150,56 C148,8 252,8 250,56 C236,84 164,84 150,56 Z",
  },
  tee: {
    body: "M132,62 C172,88 228,88 268,62 L364,140 L332,198 L294,174 L294,428 L106,428 L106,174 L68,198 L36,140 Z",
    extra: "M156,66 C176,96 224,96 244,66 C228,80 172,80 156,66 Z",
  },
  pants: {
    body: "M112,34 L288,34 L336,452 L216,452 L200,176 L184,452 L64,452 Z",
    extra: "M112,34 L288,34 L288,70 L112,70 Z",
  },
};

// Evenly spaced stone positions along a polyline.
function dotsAlong(points: [number, number][], spacing: number) {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k < n; k++) out.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
  }
  return out;
}

const crossPoints = (cx: number, cy: number, s: number): [number, number][] =>
  CROSS_PATH.split(" ").map((p) => {
    const [x, y] = p.split(",").map(Number);
    return [cx + (x - 50) * s, cy + (y - 50) * s];
  });

function Stones({ points, spacing, r }: { points: [number, number][]; spacing: number; r: number }) {
  return (
    <g>
      {dotsAlong(points, spacing).map(([x, y], i) => (
        <circle cx={x} cy={y} fill="url(#stone)" key={i} r={r} stroke="#5d5f66" strokeWidth={0.4} />
      ))}
    </g>
  );
}

/**
 * Vector concept mockup of a garment. It is NOT a photograph of a manufactured product.
 */
export function ProductArt({
  kind,
  color,
  view,
  className,
}: {
  kind: GarmentKind;
  color: string;
  view: ArtView;
  className?: string;
}) {
  const shape = SHAPES[kind];
  const cream = color.toLowerCase() === "#e6e1d6";
  const ink = cream ? "#1c1c1f" : "url(#silver)";

  if (view === "detail") {
    return (
      <svg aria-label="Close-up concept of a rhinestone cross on fabric" className={className} role="img" viewBox="0 0 400 480">
        <ArtDefs />
        <rect fill={color} height="480" width="400" />
        <rect fill="url(#weave)" height="480" width="400" />
        <polygon fill="none" points={crossPoints(200, 240, 2.6).map((p) => p.join(",")).join(" ")} stroke="#26262a" strokeWidth="2" />
        <Stones points={crossPoints(200, 240, 2.6)} r={6.5} spacing={19} />
        <Caption />
      </svg>
    );
  }

  return (
    <svg aria-label={`Concept mockup, ${view} view`} className={className} role="img" viewBox="0 0 400 480">
      <ArtDefs />
      <rect fill="url(#backdrop)" height="480" width="400" />
      <ellipse cx="200" cy="456" fill="#000" opacity=".5" rx="150" ry="10" />
      <path d={shape.body} fill={color} stroke="#ffffff" strokeOpacity=".16" strokeWidth="1.2" />
      <path d={shape.body} fill="url(#fold)" />
      {shape.extra && <path d={shape.extra} fill="#000" opacity={kind === "hoodie" ? 0.28 : 0.22} />}
      {kind === "hoodie" && <path d="M146,336 L254,336 L276,396 L124,396 Z" fill="none" stroke="#000" strokeOpacity=".4" strokeWidth="1.5" />}

      {view === "front" && (
        <g>
          {kind !== "pants" && (
            <g transform="translate(228 128) scale(.36)">
              <polygon fill={ink} points={CROSS_PATH} />
            </g>
          )}
          {kind === "pants" && (
            <g>
              <text fill={ink} fontFamily="Impact, sans-serif" fontSize="20" letterSpacing="3" transform="rotate(90 126 250)" x="126" y="250">
                LSW
              </text>
            </g>
          )}
        </g>
      )}

      {view === "back" && (
        <g>
          {kind === "hoodie" && (
            <g>
              <polygon fill="none" points={crossPoints(200, 220, 1.5).map((p) => p.join(",")).join(" ")} stroke="#2b2b2f" strokeWidth="1.5" />
              <Stones points={crossPoints(200, 220, 1.5)} r={3.2} spacing={11} />
              <g transform="translate(160 330) scale(.4)">
                {WORDMARK_PATHS.map((p) => (
                  <polygon fill="url(#silver)" key={p} points={p} />
                ))}
              </g>
            </g>
          )}
          {kind === "tee" && (
            <g>
              <g transform="translate(150 150) scale(1)">
                <polygon fill={ink} points={CROSS_PATH} />
              </g>
              <g transform="translate(142 280) scale(.42)">
                {WORDMARK_PATHS.map((p) => (
                  <polygon fill={ink} key={p} points={p} />
                ))}
              </g>
            </g>
          )}
          {kind === "pants" && (
            <g>
              <Stones points={crossPoints(110, 420, 0.14)} r={1.8} spacing={4} />
            </g>
          )}
        </g>
      )}
      <Caption />
    </svg>
  );
}

function Caption() {
  return (
    <text fill="#9a9ca4" fontFamily="ui-monospace, monospace" fontSize="10" letterSpacing="1.5" x="14" y="468">
      CONCEPT MOCKUP, NOT A PHOTO
    </text>
  );
}

function ArtDefs() {
  return (
    <defs>
      <linearGradient id="silver" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f4f4f6" />
        <stop offset=".45" stopColor="#a9abb2" />
        <stop offset=".55" stopColor="#d9dade" />
        <stop offset="1" stopColor="#7d7f86" />
      </linearGradient>
      <radialGradient cx=".35" cy=".3" id="stone" r=".8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".5" stopColor="#cfd3dc" />
        <stop offset="1" stopColor="#8f939e" />
      </radialGradient>
      <radialGradient cx=".5" cy=".38" id="backdrop" r=".75">
        <stop offset="0" stopColor="#2b2c31" />
        <stop offset=".6" stopColor="#141417" />
        <stop offset="1" stopColor="#0a0a0c" />
      </radialGradient>
      <linearGradient id="fold" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity=".07" />
        <stop offset=".5" stopColor="#000" stopOpacity=".12" />
        <stop offset="1" stopColor="#fff" stopOpacity=".05" />
      </linearGradient>
      <pattern height="6" id="weave" patternUnits="userSpaceOnUse" width="6">
        <path d="M0,6 L6,0" stroke="#fff" strokeOpacity=".05" />
      </pattern>
    </defs>
  );
}
