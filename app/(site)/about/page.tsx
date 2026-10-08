import type { Metadata } from "next";
import { Page } from "@/components/lsw/prose";

export const metadata: Metadata = { title: "Our Story", description: "What LSW stands for." };

export default function AboutPage() {
  return (
    <Page eyebrow="LSW" title="Our story">
      <p className="text-xl leading-snug text-neutral-100">Faith. Discipline. Purpose.</p>
      <p>
        LSW is a streetwear label built around three ideas. Faith is where we start. Discipline is how we show up every day. Purpose is what all of it is for.
      </p>
      <p>
        We design clothing meant to be worn hard and noticed: oversized, heavyweight, dark. The graphics are original, and the details (a crystal-outlined cross, a woven label, a sleeve line you only read up close) are there so the piece carries meaning rather than noise.
      </p>
      <p>
        We release in small drops. When a drop is made, we will say exactly how many pieces exist, and we will never claim a sellout that didn&apos;t happen.
      </p>
      <p className="text-neutral-400">Founder and brand history will be added here once the founder writes it.</p>
    </Page>
  );
}
