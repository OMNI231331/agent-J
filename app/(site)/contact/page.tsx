import type { Metadata } from "next";
import { EarlyAccessForm } from "@/components/lsw/early-access-form";
import { Page } from "@/components/lsw/prose";
import { brand } from "@/lib/lsw";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with LSW." };

export default function ContactPage() {
  return (
    <Page eyebrow="LSW" title="Contact">
      {brand.contactEmail ? (
        <p>
          Questions about an order or the collection:{" "}
          <a className="underline" href={`mailto:${brand.contactEmail}`}>
            {brand.contactEmail}
          </a>
        </p>
      ) : (
        <p className="border border-white/20 bg-white/5 p-4 text-xs">DRAFT: the support email isn&apos;t set up yet. Set NEXT_PUBLIC_CONTACT_EMAIL before launch.</p>
      )}
      <h2 className="pt-6 text-xs uppercase tracking-[0.25em] text-neutral-400">Early access</h2>
      <EarlyAccessForm id="contact-signup" />
    </Page>
  );
}
