import type { Metadata } from "next";
import { DraftNotice, Page } from "@/components/lsw/prose";

export const metadata: Metadata = { title: "Shipping and returns" };

export default function ShippingReturnsPage() {
  return (
    <Page eyebrow="Help" title="Shipping and returns">
      <DraftNotice>these policies are placeholders. Decide the real shipping regions, rates, processing time and return window, and have them reviewed before launch.</DraftNotice>
      <h2 className="text-xs uppercase tracking-[0.25em] text-neutral-400">Shipping</h2>
      <p>Shipping regions, rates and delivery times: to be confirmed.</p>
      <h2 className="text-xs uppercase tracking-[0.25em] text-neutral-400">Returns and exchanges</h2>
      <p>Return window, condition requirements and exchange process: to be confirmed. Fit is the most common reason people hesitate to buy clothing online, so a clear size guide and an easy exchange are worth deciding early.</p>
    </Page>
  );
}
