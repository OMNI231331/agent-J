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

      <Section title="Tag & label concepts">
        <p className="mb-6 max-w-2xl text-sm text-steel">Layout concepts only. Final sizes, materials, and care/compliance content depend on the manufacturer and the markets sold into — see docs/PACKAGING.md. Care, fiber, and origin fields are intentionally blank.</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Tile label="Hang tag — front (50 × 90 mm)">
            <div className="grid aspect-[5/9] w-32 place-items-center border border-line bg-black"><div className="text-center"><Monogram className="mx-auto h-10" /><Wordmark className="mx-auto mt-4 w-20" /><p className="mt-3 font-mono text-[7px] tracking-[0.3em] text-steel">DROP 001</p></div></div>
          </Tile>
          <Tile label="Hang tag — reverse">
            <div className="flex aspect-[5/9] w-32 flex-col justify-between border border-line bg-black p-3 text-center"><p className="font-mono text-[6px] leading-relaxed tracking-[0.2em] text-silver">FAITH<br />DISCIPLINE<br />PURPOSE</p><p className="text-[7px] leading-snug text-steel">More than clothing.<br />It&apos;s a reminder.</p><div className="mx-auto grid h-12 w-12 place-items-center border border-dashed border-steel text-[6px] text-steel">QR (add when store URL is final)</div></div>
          </Tile>
          <Tile label="Inside neck label (woven, ~40 × 60 mm)">
            <div className="w-40 border border-line bg-black p-4 text-center"><Wordmark className="mx-auto w-16" /><p className="mt-3 font-mono text-[8px] tracking-[0.3em] text-steel">SIZE</p><p className="display text-2xl">L</p></div>
          </Tile>
          <Tile label="Care label (sewn-in, fields blank)">
            <div className="w-40 border border-line bg-bone p-3 font-mono text-[7px] leading-relaxed text-ink">FIBER CONTENT: ________<br />WASH: ________<br />MADE IN: ________<br />MANUFACTURER / IMPORTER: ________<br />RN / ID: ________</div>
          </Tile>
          <Tile label="Limited-edition label">
            <div className="w-40 border border-line bg-black p-4 text-center"><Wordmark className="mx-auto w-14" /><p className="mt-2 font-mono text-[8px] tracking-[0.3em] text-silver">DROP 001</p><p className="font-mono text-[7px] tracking-[0.3em] text-steel">LIMITED EDITION</p><p className="mt-2 font-mono text-[7px] text-steel">No. ___ / ___ <span className="text-[6px]">(only if tracked)</span></p></div>
          </Tile>
          <Tile label="Thank-you card (~90 × 55 mm)">
            <div className="flex aspect-[90/55] w-48 flex-col items-center justify-center border border-line bg-black text-center"><Monogram className="h-8" /><p className="mt-2 font-mono text-[7px] tracking-[0.25em] text-silver">WEAR YOUR PURPOSE.</p></div>
          </Tile>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-16 border-t border-line pt-8"><h2 className="eyebrow mb-6 !text-bone">{title}</h2>{children}</section>;
}
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border border-line bg-coal p-6"><div className="flex min-h-40 items-center justify-center">{children}</div><p className="eyebrow mt-5">{label}</p></div>;
}
