"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { Monogram } from "./logo";

const WORDS = ["Faith", "Discipline", "Purpose", "More than clothing", "Drop 001"];

/** Brand marquee with a pause control (WCAG 2.2.2: moving content that runs longer than 5s must be pausable). */
export function BrandMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="relative border-b border-line">
      <div aria-hidden className="lsw-marquee overflow-hidden py-5 sm:py-7" data-paused={paused || undefined}>
        <div className="lsw-marquee-track">
          {[0, 1].map((k) => (
            <span className="flex shrink-0 items-center" key={k}>
              {WORDS.map((t, i) => (
                <span className="flex items-center" key={t}>
                  <span className={`display px-6 text-3xl sm:px-10 sm:text-5xl ${i % 2 ? "lsw-outline-strong" : ""}`}>{t}</span>
                  <Monogram className="h-5 w-5 sm:h-7 sm:w-7" mono />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <button
        aria-label={paused ? "Play scrolling banner" : "Pause scrolling banner"}
        aria-pressed={paused}
        className="lsw-marquee-toggle absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-steel hover:text-bone"
        onClick={() => setPaused((p) => !p)}
        type="button"
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  );
}
