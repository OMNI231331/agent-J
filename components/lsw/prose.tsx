import type { ReactNode } from "react";

export function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-neutral-300">{children}</div>
    </div>
  );
}

export function DraftNotice({ children }: { children: ReactNode }) {
  return <p className="border border-white/20 bg-white/5 p-4 text-xs text-neutral-300">DRAFT: {children}</p>;
}
