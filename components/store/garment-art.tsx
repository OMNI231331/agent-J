import { COLORS, type ColorId, type Garment } from "@/lib/catalog";
import { MONOGRAM_BLADES, MONOGRAM_VIEWBOX, WORDMARK_GLYPHS, WORDMARK_PATH, sampleOutline, toPath } from "@/lib/brand";
import { useId } from "react";

export type ArtView = "front" | "back" | "detail" | "label";
type Props = {
  garment: Garment;
  color: ColorId;
  view: ArtView;
  /** 1 = no crystals, 2 = crystal outline, 3 = outline + fill */
  level: 1 | 2 | 3;
  className?: string;
};

const SILHOUETTE: Record<Garment, { front: string; back?: string }> = {
  hoodie: {
    front:
      "M128 74 C150 58 176 52 200 52 C224 52 250 58 272 74 L332 98 C348 104 358 116 361 132 L384 338 L330 348 L318 222 L324 440 L76 440 L82 222 L70 348 L16 338 L39 132 C42 116 52 104 68 98 Z",
  },
  "statement-hoodie": {
    front:
      "M128 74 C150 58 176 52 200 52 C224 52 250 58 272 74 L332 98 C348 104 358 116 361 132 L384 338 L330 348 L318 222 L324 440 L76 440 L82 222 L70 348 L16 338 L39 132 C42 116 52 104 68 98 Z",
  },
  tee: {
    front: "M138 58 C165 80 235 80 262 58 L342 92 L388 182 L332 204 L318 170 L324 440 L76 440 L82 170 L68 204 L12 182 L58 92 Z",
  },
  beanie: { front: "M78 330 C74 130 132 62 200 62 C268 62 326 130 322 330 Z" },
};

/** Concept render of a garment (lit vector illustration). NOT a photograph. */
export function GarmentArt({ garment, color, view, level, className }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const base = COLORS[color].hex;
  const isHoodie = garment === "hoodie" || garment === "statement-hoodie";
  const isBeanie = garment === "beanie";

  // ---- crystal helper ----
  // Every 7th stone carries a glint; `.lsw-glint` twinkles via CSS (off with reduced motion).
  let stoneN = 0;
  const Stone = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => {
    const n = stoneN++;
    return (
      <g>
        <ellipse cx={x + r * 0.35} cy={y + r * 0.6} rx={r * 1.05} ry={r * 0.85} fill="#000" opacity=".55" />
        <circle cx={x} cy={y} r={r} fill={`url(#stone${uid})`} stroke="#5d6066" strokeWidth={r * 0.12} />
        <path d={`M${x - r * 0.62} ${y - r * 0.1} L${x - r * 0.1} ${y - r * 0.62} L${x + r * 0.3} ${y - r * 0.2} L${x - r * 0.2} ${y + r * 0.3} Z`} fill="#fff" opacity=".9" />
        <circle cx={x + r * 0.38} cy={y + r * 0.42} r={r * 0.18} fill="#cfe3ff" opacity=".7" />
        {n % 7 === 3 && (
          <path className="lsw-glint" style={{ animationDelay: `${(n * 0.37) % 4}s` }} d={`M${x} ${y - r * 2.6} L${x + r * 0.22} ${y} L${x} ${y + r * 2.6} L${x - r * 0.22} ${y} Z M${x - r * 2.6} ${y} L${x} ${y - r * 0.22} L${x + r * 2.6} ${y} L${x} ${y + r * 0.22} Z`} fill="#fff" />
        )}
      </g>
    );
  };
  const crossAt = (cx: number, cy: number, scale: number) => {
    const k = scale / MONOGRAM_VIEWBOX.w;
    const t = (p: readonly [number, number]) => [cx + (p[0] - 50) * k, cy + (p[1] - 50) * k] as const;
    return MONOGRAM_BLADES.map((b) => b.map(t));
  };
  const Cross = ({ cx, cy, size, stones }: { cx: number; cy: number; size: number; stones: boolean }) => {
    const blades = crossAt(cx, cy, size);
    const spacing = Math.max(5.2, size / 22);
    return (
      <g filter={stones ? `url(#halo${uid})` : undefined}>
        {!stones && blades.map((b, i) => <path key={i} d={toPath(b)} fill="#d8d6cf" opacity=".92" />)}
        {stones && level >= 3 && blades.map((b, i) => <path key={i} d={toPath(b)} fill="#0b0b0c" opacity=".55" />)}
        {stones && blades.flatMap((b, i) => sampleOutline(b, spacing, spacing * 0.2).map(([x, y], j) => <Stone key={`${i}-${j}`} x={x} y={y} r={Math.max(1.8, spacing * 0.36)} />))}
        {stones && level >= 3 && blades.flatMap((b, i) => sampleOutline(b, spacing * 1.15, spacing * 1.6).map(([x, y], j) => <Stone key={`f${i}-${j}`} x={x} y={y} r={Math.max(1.5, spacing * 0.3)} />))}
      </g>
    );
  };
  const MiniWord = ({ x, y, w, fill = "#d8d6cf" }: { x: number; y: number; w: number; fill?: string }) => (
    <path d={WORDMARK_PATH} fill={fill} transform={`translate(${x} ${y}) scale(${w / 330})`} />
  );

  const body = SILHOUETTE[garment].front;

  // ---- detail / label views are close-ups ----
  if (view === "detail") {
    const blades = crossAt(200, 250, 300);
    const spacing = 15;
    return (
      <svg viewBox="0 0 400 500" className={className} role="img" aria-label="Concept render: crystal detail close-up">
        <Defs uid={uid} base={base} />
        <rect width="400" height="500" fill={base} />
        <rect width="400" height="500" filter={`url(#knit${uid})`} opacity=".3" style={{ mixBlendMode: "overlay" }} />
        <rect width="400" height="500" fill={`url(#light${uid})`} />
        <rect width="400" height="500" fill={`url(#vignette${uid})`} />
        {level >= 2 ? (
          <g filter={`url(#halo${uid})`}>{blades.flatMap((b, i) => sampleOutline(b, spacing, 3).map(([x, y], j) => <Stone key={`${i}-${j}`} x={x} y={y} r={5.6} />))}</g>
        ) : (
          <MiniWord x={40} y={210} w={320} />
        )}
      </svg>
    );
  }
  if (view === "label") {
    return (
      <svg viewBox="0 0 400 500" className={className} role="img" aria-label="Concept render: interior neck label">
        <Defs uid={uid} base={base} />
        <rect width="400" height="500" fill={base} />
        <rect width="400" height="500" filter={`url(#knit${uid})`} opacity=".3" style={{ mixBlendMode: "overlay" }} />
        <path d="M-20 120 C120 168 280 168 420 120 L420 160 C280 208 120 208 -20 160 Z" fill="#000" opacity=".28" filter={`url(#soft${uid})`} />
        <rect width="400" height="500" fill={`url(#light${uid})`} />
        <g transform="translate(80 175) rotate(-1.5 120 75)">
          <rect x="4" y="8" width="240" height="150" fill="#000" opacity=".5" filter={`url(#soft${uid})`} />
          <rect width="240" height="150" fill="#0b0b0c" />
          <rect width="240" height="150" filter={`url(#weave${uid})`} opacity=".5" />
          <rect x="6" y="6" width="228" height="138" fill="none" stroke="#3a3b40" strokeDasharray="4 3" />
          <MiniWord x={60} y={30} w={120} fill={`url(#chromeA${uid})`} />
          <text x="120" y="92" textAnchor="middle" fill="#a3a6ac" fontFamily="monospace" fontSize="10" letterSpacing="3">DROP 001</text>
          <text x="120" y="112" textAnchor="middle" fill="#7d8086" fontFamily="monospace" fontSize="8" letterSpacing="3">LIMITED EDITION</text>
        </g>
        <rect width="400" height="500" fill={`url(#vignette${uid})`} />
      </svg>
    );
  }

  const back = view === "back";

  const hood = back
    ? "M126 78 C122 22 160 6 200 6 C240 6 278 22 274 78 C250 96 150 96 126 78 Z"
    : "M132 76 C128 26 164 8 200 8 C236 8 272 26 268 76 C250 102 226 112 200 114 C174 112 150 102 132 76 Z";
  const cuffL = "M16 338 L70 348 L67 376 Q40 374 11 366 Z";
  const cuffR = "M384 338 L330 348 L333 376 Q360 374 389 366 Z";
  const hem = "M76 418 H324 V440 Q200 448 76 440 Z";
  // Folds: soft light and shadow strokes, blurred, clipped to the garment.
  const folds = isHoodie
    ? ["M96 150 C110 210 104 280 120 330", "M300 150 C292 220 300 280 286 330", "M60 180 C54 240 52 290 46 330", "M340 180 C346 240 348 290 354 330", "M150 380 C170 395 230 395 250 380"]
    : garment === "tee"
      ? ["M110 120 C124 200 112 300 128 420", "M290 120 C278 210 292 320 274 420", "M60 110 L90 170", "M340 110 L310 170"]
      : ["M140 120 C150 200 150 260 156 320", "M260 120 C250 200 250 260 244 320"];
  const shapes = isBeanie ? [body] : [body, ...(isHoodie ? [hood, cuffL, cuffR, hem] : [])];

  return (
    <svg viewBox="0 0 400 500" className={className} role="img" aria-label={`Concept render: ${garment.replace("-", " ")} ${view}`}>
      <Defs uid={uid} base={base} />
      <clipPath id={`clip${uid}`}>{shapes.map((d) => <path d={d} key={d} />)}{isBeanie && <rect x="64" y="318" width="272" height="96" rx="10" />}</clipPath>
      {/* ground shadow */}
      <ellipse cx="200" cy="466" rx="168" ry="14" fill={`url(#floor${uid})`} />

      {/* base shapes */}
      <g fill={base} stroke="rgba(0,0,0,.6)" strokeWidth="1.2">
        {isHoodie && <path d={hood} />}
        <path d={body} />
        {isHoodie && (
          <>
            <path d={cuffL} /><path d={cuffR} /><path d={hem} />
          </>
        )}
        {isBeanie && <rect x="64" y="318" width="272" height="96" rx="10" />}
      </g>

      {/* lighting, texture and folds, all clipped to the garment */}
      <g clipPath={`url(#clip${uid})`}>
        <rect width="400" height="500" filter={`url(#knit${uid})`} opacity=".22" style={{ mixBlendMode: "overlay" }} />
        {isHoodie && [cuffL, cuffR, hem].map((d) => <path d={d} fill={`url(#rib${uid})`} key={`r${d}`} />)}
        {isBeanie && <rect x="64" y="318" width="272" height="96" fill={`url(#rib${uid})`} />}
        <g fill="none" filter={`url(#soft${uid})`} strokeLinecap="round">
          {folds.map((d) => <path d={d} key={d} stroke="#000" strokeOpacity=".45" strokeWidth="9" />)}
          {folds.map((d) => <path d={d} key={`h${d}`} stroke="#fff" strokeOpacity=".06" strokeWidth="4" transform="translate(-6 -2)" />)}
        </g>
        <rect width="400" height="500" fill={`url(#shade${uid})`} />
        <rect width="400" height="500" fill={`url(#light${uid})`} />
        {isHoodie && !back && <path d="M158 70 C160 44 180 30 200 30 C220 30 240 44 242 70 C230 90 216 98 200 100 C184 98 170 90 158 70 Z" fill={`url(#hoodIn${uid})`} />}
        {isHoodie && <path d="M76 418 H324 M16 338 L70 348 M384 338 L330 348" stroke="#000" strokeOpacity=".5" strokeWidth="3" filter={`url(#soft${uid})`} />}
      </g>

      {/* construction */}
      {isHoodie && !back && (
        <g>
          <path d="M110 330 L134 262 H266 L290 330 Z" fill="#fff" fillOpacity=".025" stroke="#000" strokeOpacity=".5" strokeWidth="1.5" />
          <path d="M134 262 H266" stroke="#fff" strokeOpacity=".09" />
          <path d="M112 326 L134 266 M288 326 L266 266" stroke="#000" strokeOpacity=".55" strokeWidth="5" filter={`url(#soft${uid})`} />
          {/* drawcords with metal aglets */}
          <path d="M186 102 C184 130 188 150 185 172 M214 102 C216 126 212 146 215 164" fill="none" stroke="#c9ccd1" strokeOpacity=".75" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="181.5" y="170" width="7" height="13" rx="2" fill={`url(#metal${uid})`} />
          <rect x="211.5" y="162" width="7" height="13" rx="2" fill={`url(#metal${uid})`} />
        </g>
      )}
      {isHoodie && back && <path d="M200 96 V418" stroke="#fff" strokeOpacity=".05" strokeDasharray="3 5" />}
      {garment === "tee" && !back && <path d="M138 58 C165 96 235 96 262 58" fill="none" stroke="#000" strokeOpacity=".55" strokeWidth="7" />}
      {garment === "tee" && back && <path d="M138 58 C165 72 235 72 262 58" fill="none" stroke="#000" strokeOpacity=".55" strokeWidth="5" />}

      {/* ---- graphics ---- */}
      {garment === "hoodie" && !back && <MiniWord x={226} y={150} w={40} />}
      {garment === "hoodie" && back && <Cross cx={200} cy={265} size={210} stones />}
      {garment === "hoodie" && !back && <Cross cx={48} cy={262} size={46} stones />}
      {garment === "statement-hoodie" && back && <Cross cx={200} cy={260} size={250} stones />}
      {garment === "statement-hoodie" && !back && <MiniWord x={226} y={150} w={40} />}
      {garment === "tee" && !back && <MiniWord x={238} y={150} w={34} />}
      {garment === "tee" && back && (
        <g mask={`url(#worn${uid})`} opacity=".92">
          <Cross cx={200} cy={225} size={150} stones={false} />
          <text x="200" y="340" textAnchor="middle" fill="#d8d6cf" fontFamily="monospace" fontSize="13" letterSpacing="5">FAITH / DISCIPLINE / PURPOSE</text>
        </g>
      )}
      {isBeanie && <MiniWord x={158} y={348} w={84} fill={`url(#chromeA${uid})`} />}
    </svg>
  );
}

function Defs({ uid, base }: { uid: string; base: string }) {
  return (
    <defs>
      {/* key light from upper left */}
      <radialGradient id={`light${uid}`} cx=".36" cy=".2" r=".75">
        <stop offset="0" stopColor="#fff" stopOpacity=".11" />
        <stop offset=".45" stopColor="#fff" stopOpacity=".04" />
        <stop offset="1" stopColor="#000" stopOpacity=".42" />
      </radialGradient>
      {/* rounds the body: darker at both sides */}
      <linearGradient id={`shade${uid}`} x1="0" x2="1">
        <stop offset="0" stopColor="#000" stopOpacity=".55" />
        <stop offset=".22" stopColor="#000" stopOpacity="0" />
        <stop offset=".78" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".6" />
      </linearGradient>
      <radialGradient id={`vignette${uid}`} cx=".5" cy=".45" r=".75">
        <stop offset=".55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".6" />
      </radialGradient>
      <radialGradient id={`floor${uid}`}>
        <stop offset="0" stopColor="#000" stopOpacity=".75" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`hoodIn${uid}`} cx=".5" cy=".3" r=".7">
        <stop offset="0" stopColor="#000" stopOpacity=".95" />
        <stop offset="1" stopColor="#000" stopOpacity=".7" />
      </radialGradient>
      <pattern id={`rib${uid}`} width="5" height="8" patternUnits="userSpaceOnUse">
        <rect width="2" height="8" fill="#000" opacity=".22" />
      </pattern>
      <linearGradient id={`metal${uid}`} x1="0" x2="1">
        <stop offset="0" stopColor="#6d7076" />
        <stop offset=".45" stopColor="#f2f3f5" />
        <stop offset="1" stopColor="#7a7d83" />
      </linearGradient>
      <linearGradient id={`chromeA${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f5f7" />
        <stop offset=".45" stopColor="#9ea1a8" />
        <stop offset=".55" stopColor="#e9ebee" />
        <stop offset="1" stopColor="#6d7076" />
      </linearGradient>
      <radialGradient id={`stone${uid}`} cx=".35" cy=".3" r=".85">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".35" stopColor="#e6eaf0" />
        <stop offset=".7" stopColor="#9aa0a8" />
        <stop offset="1" stopColor="#4b4e54" />
      </radialGradient>
      <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id={`halo${uid}`} x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b" />
        <feColorMatrix in="b" values="0 0 0 0 .85  0 0 0 0 .9  0 0 0 0 1  0 0 0 .5 0" result="g" />
        <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      {/* fine fleece / jersey texture */}
      <filter id={`knit${uid}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".9 1.6" numOctaves="2" seed="4" />
        <feColorMatrix values="1.4 0 0 0 -.35  1.4 0 0 0 -.35  1.4 0 0 0 -.35  0 0 0 0 .35" />
      </filter>
      <filter id={`weave${uid}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="turbulence" baseFrequency="1.2 .15" numOctaves="1" seed="2" />
        <feColorMatrix values="0 0 0 0 .6  0 0 0 0 .6  0 0 0 0 .6  0 0 0 .35 0" />
      </filter>
      {/* worn print: noise punches holes into the graphic only */}
      <filter id={`distress${uid}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".05 .7" numOctaves="3" seed="9" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -5.3" />
      </filter>
      <mask id={`worn${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="500">
        <rect width="400" height="500" fill="#fff" />
        <rect width="400" height="500" filter={`url(#distress${uid})`} />
      </mask>
    </defs>
  );
}
