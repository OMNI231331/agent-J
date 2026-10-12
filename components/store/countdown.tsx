"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Counts down to one fixed, server-supplied instant. It never resets: every visitor counts to the same
 * moment, and at zero the page re-renders from the server (which is what actually opens checkout).
 */
export function Countdown({ to, label, compact = false }: { to: number; label: string; compact?: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= to) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [to, router]);

  const left = now === null ? 0 : Math.max(0, to - now);
  const s = Math.floor(left / 1000);
  const parts: [string, number][] = [["Days", Math.floor(s / 86400)], ["Hrs", Math.floor(s / 3600) % 24], ["Min", Math.floor(s / 60) % 60], ["Sec", s % 60]];

  return (
    <div>
      {/* The live numbers are hidden from screen readers (a per-second announcement is noise); the fixed time is read instead. */}
      <p className="sr-only">Opens {label}</p>
      <div aria-hidden className="flex gap-2 sm:gap-3">
        {parts.map(([unit, n]) => (
          <div className={`border border-line bg-ink/60 text-center ${compact ? "min-w-[3.5rem] px-2 py-2" : "min-w-[4.25rem] px-3 py-3 sm:min-w-[5.5rem] sm:py-4"}`} key={unit}>
            <div className={`font-mono tabular-nums text-bone ${compact ? "text-xl" : "text-2xl sm:text-4xl"}`}>{now === null ? "––" : String(n).padStart(2, "0")}</div>
            <div className="eyebrow mt-1 !text-[10px]">{unit}</div>
          </div>
        ))}
      </div>
      <p aria-hidden className="eyebrow mt-3">{label}</p>
    </div>
  );
}
