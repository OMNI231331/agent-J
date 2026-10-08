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

/** Concept render of a garment (flat vector). NOT a photograph. */
export function GarmentArt({ garment, color, view, level, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const base = COLORS[color].hex;
  const isHoodie = garment === "hoodie" || garment === "statement-hoodie";
  const isBeanie = garment === "beanie";
  const lines = "rgba(255,255,255,0.07)";
  const seam = "rgba(0,0,0,0.5)";

  // ---- crystal helper ----
  const Stone = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => (
    <g>
      <ellipse cx={x + 0.9} cy={y + 1.5} rx={r} ry={r * 0.8} fill="#000" opacity=".5" />
      <circle cx={x} cy={y} r={r} fill={`url(#stone${uid})`} stroke="#6f7279" strokeWidth=".4" />
      <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.28} fill="#fff" opacity=".95" />
    </g>
  );
  const crossAt = (cx: number, cy: number, scale: number) => {
    const k = scale / MONOGRAM_VIEWBOX.w;
    const t = (p: readonly [number, number]) => [cx + (p[0] - 50) * k, cy + (p[1] - 50) * k] as const;
    return MONOGRAM_BLADES.map((b) => b.map(t));
  };
  const Cross = ({ cx, cy, size, stones }: { cx: number; cy: number; size: number; stones: boolean }) => {
    const blades = crossAt(cx, cy, size);
    const spacing = Math.max(5.2, size / 22);
    return (
      <g>
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
        <rect width="400" height="500" fill={`url(#fab${uid})`} />
        <rect width="400" height="500" filter={`url(#grain${uid})`} opacity=".5" />
        {level >= 2 ? (
          blades.flatMap((b, i) => sampleOutline(b, spacing, 3).map(([x, y], j) => <Stone key={`${i}-${j}`} x={x} y={y} r={5.4} />))
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
        <rect width="400" height="500" fill={`url(#fab${uid})`} />
        <rect width="400" height="500" filter={`url(#grain${uid})`} opacity=".5" />
        <g transform="translate(80 170)">
          <rect width="240" height="150" fill="#0a0a0b" stroke="#2a2b2f" />
          <MiniWord x={60} y={30} w={120} fill="#c9ccd1" />
          <text x="120" y="92" textAnchor="middle" fill="#92959b" fontFamily="monospace" fontSize="10" letterSpacing="3">DROP 001</text>
          <text x="120" y="112" textAnchor="middle" fill="#92959b" fontFamily="monospace" fontSize="8" letterSpacing="3">LIMITED EDITION</text>
        </g>
      </svg>
    );
  }

  const back = view === "back";

  return (
    <svg viewBox="0 0 400 500" className={className} role="img" aria-label={`Concept render: ${garment.replace("-", " ")} ${view}`}>
      <Defs uid={uid} base={base} />
      {/* ground shadow */}
      <ellipse cx="200" cy="468" rx="150" ry="10" fill="#000" opacity=".55" />
      {isHoodie && (
        <g>
          {/* hood */}
          {back ? (
            <path d="M126 78 C122 22 160 6 200 6 C240 6 278 22 274 78 C250 96 150 96 126 78 Z" fill={`url(#fab${uid})`} stroke={seam} />
          ) : (
            <g>
              <path d="M132 76 C128 26 164 8 200 8 C236 8 272 26 268 76 C250 102 226 112 200 114 C174 112 150 102 132 76 Z" fill={`url(#fab${uid})`} stroke={seam} />
              <path d="M158 70 C160 44 180 30 200 30 C220 30 240 44 242 70 C230 90 216 98 200 100 C184 98 170 90 158 70 Z" fill="#050506" />
            </g>
          )}
        </g>
      )}
      {/* body */}
      {isBeanie ? (
        <g>
          <path d={body} fill={`url(#fab${uid})`} stroke={seam} />
          <rect x="64" y="318" width="272" height="96" rx="10" fill={`url(#fab${uid})`} stroke={seam} />
          {Array.from({ length: 19 }, (_, i) => (
            <line key={i} x1={80 + i * 13.5} y1="322" x2={80 + i * 13.5} y2="410" stroke={lines} strokeWidth="5" />
          ))}
        </g>
      ) : (
        <path d={body} fill={`url(#fab${uid})`} stroke={seam} strokeWidth="1.2" />
      )}
      {(isHoodie || garment === "tee") && <rect width="400" height="500" filter={`url(#grain${uid})`} opacity=".35" style={{ mixBlendMode: "overlay" }} clipPath={`url(#clip${uid})`} />}
      <clipPath id={`clip${uid}`}><path d={body} /></clipPath>

      {/* construction */}
      {isHoodie && (
        <g fill="none" stroke={lines} strokeWidth="2">
          <rect x="76" y="418" width="248" height="24" fill={`url(#fab${uid})`} stroke={seam} />
          <rect x="20" y="332" width="64" height="22" transform="rotate(-8 52 343)" />
          <rect x="316" y="332" width="64" height="22" transform="rotate(8 348 343)" />
          {!back && <path d="M110 330 L134 262 H266 L290 330 Z" />}
          {!back && <path d="M186 100 V170 M214 100 V160" stroke="#c9ccd1" strokeOpacity=".5" />}
          {back && <path d="M200 96 V418" strokeDasharray="3 5" />}
        </g>
      )}
      {garment === "tee" && !back && <path d="M138 58 C165 96 235 96 262 58" fill="none" stroke={seam} strokeWidth="6" opacity=".7" />}
      {garment === "tee" && back && <path d="M138 58 C165 72 235 72 262 58" fill="none" stroke={seam} strokeWidth="5" opacity=".7" />}

      {/* ---- graphics ---- */}
      {garment === "hoodie" && !back && (
        <g>
          <MiniWord x={226} y={150} w={40} />
        </g>
      )}
      {garment === "hoodie" && back && <Cross cx={200} cy={265} size={210} stones />}
      {garment === "hoodie" && !back && <Cross cx={68} cy={300} size={34} stones />}
      {garment === "statement-hoodie" && back && <Cross cx={200} cy={260} size={250} stones />}
      {garment === "statement-hoodie" && !back && <MiniWord x={226} y={150} w={40} />}
      {garment === "tee" && !back && <MiniWord x={238} y={150} w={34} />}
      {garment === "tee" && back && (
        <g opacity=".9">
          <Cross cx={200} cy={225} size={150} stones={false} />
          <text x="200" y="340" textAnchor="middle" fill="#d8d6cf" fontFamily="monospace" fontSize="13" letterSpacing="5" opacity=".85">FAITH / DISCIPLINE / PURPOSE</text>
          <rect width="400" height="500" filter={`url(#distress${uid})`} fill="#0b0b0c" opacity=".35" clipPath={`url(#clip${uid})`} />
        </g>
      )}
      {isBeanie && <MiniWord x={158} y={348} w={84} fill="#c9ccd1" />}
    </svg>
  );
}

function Defs({ uid, base }: { uid: string; base: string }) {
  return (
    <defs>
      <linearGradient id={`fab${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={base} stopOpacity="1" />
        <stop offset="0" stopColor="#fff" stopOpacity=".05" />
        <stop offset="1" stopColor="#000" stopOpacity=".35" />
      </linearGradient>
      <radialGradient id={`stone${uid}`} cx=".38" cy=".35" r=".8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".45" stopColor="#dfe2e7" />
        <stop offset="1" stopColor="#8d9096" />
      </radialGradient>
      <filter id={`grain${uid}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" />
        <feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .45 0" />
      </filter>
      <filter id={`distress${uid}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".04 .6" numOctaves="3" seed="9" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -4.2" />
      </filter>
    </defs>
  );
}
