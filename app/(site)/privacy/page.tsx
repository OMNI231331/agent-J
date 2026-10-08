import type { Metadata } from "next";
import { DraftNotice, Page } from "@/components/lsw/prose";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <Page eyebrow="Legal" title="Privacy">
      <DraftNotice>this is a placeholder, not a privacy policy. Have a qualified professional write the real one before collecting emails or taking orders.</DraftNotice>
      <p>What the site does today: the shopping bag is stored in your own browser, and an email you enter for early access is sent only to the sign-up service the store owner configures. Orders and payments will be handled by the payment provider once checkout is live.</p>
      <p>The full policy (what is collected, why, how long it is kept, and how to ask for deletion) is to be written.</p>
    </Page>
  );
}
