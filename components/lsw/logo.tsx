// First-pass original LSW marks, drawn as vector paths. Concept artwork:
// have a designer refine the letterforms before this goes on embroidery, labels or trademark filings.

export const WORDMARK_PATHS = [
  "10,8 38,8 38,68 84,68 76,92 10,92",
  "100,8 160,8 152,28 126,28 126,40 160,52 160,92 98,92 106,72 134,72 134,62 98,48",
  "176,8 204,8 214,58 228,8 252,8 266,58 276,8 304,8 284,92 258,92 240,44 222,92 196,92",
];
export const CROSS_PATH =
  "44,0 56,0 60,34 94,38 100,48 100,52 94,62 60,66 56,100 44,100 40,66 6,62 0,52 0,48 6,38 40,34";

function SilverDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f4f6" />
        <stop offset="0.45" stopColor="#a9abb2" />
        <stop offset="0.55" stopColor="#d9dade" />
        <stop offset="1" stopColor="#7d7f86" />
      </linearGradient>
    </defs>
  );
}

export function Wordmark({ className, label = "LSW" }: { className?: string; label?: string }) {
  return (
    <svg aria-label={label} className={className} role="img" viewBox="0 0 314 100">
      <SilverDefs id="lswSilverW" />
      {WORDMARK_PATHS.map((p) => (
        <polygon fill="url(#lswSilverW)" key={p} points={p} />
      ))}
    </svg>
  );
}

export function Cross({ className, label = "LSW cross" }: { className?: string; label?: string }) {
  return (
    <svg aria-label={label} className={className} role="img" viewBox="0 0 100 100">
      <SilverDefs id="lswSilverC" />
      <polygon fill="url(#lswSilverC)" points={CROSS_PATH} />
    </svg>
  );
}
