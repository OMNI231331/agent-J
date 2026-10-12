import type { Metadata } from "next";
import { Monogram, Wordmark } from "@/components/store/logo";
import { COLORS } from "@/lib/catalog";

export const metadata: Metadata = { title: "Brand System", robots: { index: false } };

const palette = [
  ["Ink", "#0A0A0B", "Page background"], ["Coal", "#111113", "Raised surfaces"], ["Graphite", "#1A1B1E", "Cards, inputs"],
  ["Line", "#2A2B2F", "Hairline borders"], ["Steel", "#92959B", "Secondary text"], ["Silver", "#C9CCD1", "Metallic accent"], ["Bone", "#ECE9E2", "Primary text, off-white"],
];
const files = [
  ["Primary wordmark (chrome)", "lsw-wordmark.svg"], ["Monochrome wordmark", "lsw-wordmark-mono.svg"], ["Symbol / monogram", "lsw-monogram.svg"],
  ["Lockup (symbol + wordmark)", "lsw-lockup.svg"], ["Small label version", "lsw-label-small.svg"], ["Back statement graphic", "lsw-back-statement.svg"],
  ["Embroidery", "lsw-embroidery.svg"], ["Screen print (1 colour)", "lsw-screenprint.svg"], ["Rhinestone layout", "lsw-rhinestone.svg"], ["Symbol rhinestone layout", "lsw-monogram-rhinestone.svg"],
];

const tagFiles = [
  ["Hang tag · front · 50×90", "hang-tag-front-50x90mm.svg"], ["Hang tag · reverse", "hang-tag-reverse-50x90mm.svg"],
  ["Neck label · woven · 40×60", "neck-label-woven-40x60mm.svg"], ["Care label · 40×70", "care-label-40x70mm.svg"], ["Limited label · 35×35", "limited-label-35x35mm.svg"],
];
const packFiles = [
  ["Seal sticker · Ø40", "seal-sticker-40mm.svg"], ["Thank-you card · front · 90×55", "thank-you-card-front-90x55mm.svg"], ["Thank-you card · back", "thank-you-card-back-90x55mm.svg"],
  ["Product info card · 90×55", "product-info-card-90x55mm.svg"], ["Tissue repeat tile · 60 mm", "tissue-repeat-tile-60mm.svg"], ["Mailer face · 350×280", "mailer-front-350x280mm.svg"],
];

export default function BrandPage() {
  return (
    <div className="container-lsw py-16 sm:py-24">
      <p className="eyebrow">Internal reference</p>
      <h1 className="display mt-3 text-5xl sm:text-7xl">Brand system</h1>

      <Section title="Logo system">
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile label="Primary wordmark"><Wordmark className="h-14" /></Tile>
          <Tile label="Symbol"><Monogram className="h-24" /></Tile>
          <Tile label="Monochrome · small (24px)"><Wordmark className="h-6 text-bone" mono /></Tile>
        </div>
        <ul className="mt-6 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {files.map(([n, f]) => (
            <li className="flex flex-wrap justify-between gap-x-4 border-b border-line py-2" key={f}><span>{n}</span><a className="break-all font-mono text-steel underline" href={`/brand/${f}`}>{f}</a></li>
          ))}
        </ul>
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {palette.map(([n, h, u]) => (
            <div className="border border-line" key={n}><div className="h-20" style={{ background: h }} /><div className="p-3"><p className="text-sm">{n}</p><p className="font-mono text-xs text-steel">{h}</p><p className="mt-1 text-xs text-steel">{u}</p></div></div>
          ))}
        </div>
        <p className="eyebrow mt-8">Garment colors</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.values(COLORS).map((c) => <div className="flex items-center gap-2 text-sm" key={c.name}><span className="h-6 w-6 border border-steel" style={{ background: c.hex }} />{c.name}</div>)}
        </div>
      </Section>

      <Section title="Type">
        <p className="display text-4xl sm:text-6xl">Archivo Expanded</p>
        <p className="eyebrow mt-2">Display — headlines, uppercase, tight tracking</p>
        <p className="mt-6 text-xl">Geist — body and UI copy.</p>
        <p className="mt-2 font-mono text-sm tracking-widest text-steel">GEIST MONO — LABELS · 0.22EM · UPPERCASE</p>
      </Section>

      <Section title="Tags & labels — print files">
        <p className="mb-6 max-w-2xl text-sm text-steel">These are the actual print-proof files (1 SVG unit = 1 mm). Final materials, foil and woven construction come from the manufacturer; care, fiber and origin fields stay blank until confirmed — see docs/PACKAGING.md.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {tagFiles.map(([label, f]) => <FileTile file={`tags/${f}`} key={f} label={label} />)}
        </div>
      </Section>

      <Section title="Packaging — print files">
        <p className="mb-6 max-w-2xl text-sm text-steel">Start lean for DROP 001: a stock black mailer, the seal sticker, tissue, and both cards. Print the custom mailer face once volume clears the printer&apos;s minimums. QR slots stay empty until the store URL is live and test-scanned.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {packFiles.map(([label, f]) => <FileTile file={`packaging/${f}`} key={f} label={label} />)}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-16 border-t border-line pt-8"><h2 className="eyebrow mb-6 !text-bone">{title}</h2>{children}</section>;
}
function FileTile({ label, file }: { label: string; file: string }) {
  return (
    <a className="group block border border-line bg-coal p-4 hover:border-silver" href={`/brand/${file}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG proof, shown at its own aspect ratio */}
      <img alt={`${label} print proof`} className="mx-auto h-40 w-full object-contain" loading="lazy" src={`/brand/${file}`} />
      <p className="eyebrow mt-4 group-hover:text-bone">{label}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-steel">{file}</p>
    </a>
  );
}
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border border-line bg-coal p-6"><div className="flex min-h-40 items-center justify-center">{children}</div><p className="eyebrow mt-5">{label}</p></div>;
}
