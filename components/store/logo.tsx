import { MONOGRAM_BLADES, MONOGRAM_CUTOUT, MONOGRAM_PATH, MONOGRAM_VIEWBOX, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/brand";
import { useId } from "react";

/** Chrome-style gradient used on dark backgrounds. */
function Chrome({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f5f7" />
        <stop offset=".45" stopColor="#9ea1a8" />
        <stop offset=".55" stopColor="#e9ebee" />
        <stop offset="1" stopColor="#5d6066" />
      </linearGradient>
    </defs>
  );
}

type LogoProps = { className?: string; label?: string; mono?: boolean };

/** LSW primary wordmark. `mono` uses currentColor (small sizes, one-colour contexts). */
export function Wordmark({ className, label = "LSW", mono = false }: LogoProps) {
  const id = useId();
  return (
    <svg className={className} viewBox={`0 0 ${WORDMARK_VIEWBOX.w} ${WORDMARK_VIEWBOX.h}`} role="img" aria-label={label}>
      {!mono && <Chrome id={id} />}
      <path d={WORDMARK_PATH} fill={mono ? "currentColor" : `url(#${id})`} />
    </svg>
  );
}

/** Standalone spiked-cross symbol. */
export function Monogram({ className, label = "LSW symbol", mono = false }: LogoProps) {
  const id = useId();
  return (
    <svg className={className} viewBox={`0 0 ${MONOGRAM_VIEWBOX.w} ${MONOGRAM_VIEWBOX.h}`} role="img" aria-label={label}>
      {!mono && <Chrome id={id} />}
      <path d={MONOGRAM_PATH} fillRule="evenodd" fill={mono ? "currentColor" : `url(#${id})`} />
    </svg>
  );
}

export { MONOGRAM_BLADES, MONOGRAM_CUTOUT };
