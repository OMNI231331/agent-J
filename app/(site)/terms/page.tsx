import type { Metadata } from "next";
import { DraftNotice, Page } from "@/components/lsw/prose";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <Page eyebrow="Legal" title="Terms">
      <DraftNotice>this is a placeholder, not terms of sale. Have a qualified professional write the real ones before launch.</DraftNotice>
      <p>Terms of sale, pricing, limited-edition releases, returns and liability: to be written.</p>
    </Page>
  );
}
