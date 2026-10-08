import type { Metadata } from "next";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with LSW." };

export default function ContactPage() {
  return (
    <div className="container-lsw grid gap-12 py-16 sm:py-24 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="display mt-3 text-5xl sm:text-7xl">Get in touch</h1>
        {site.contactEmail ? (
          <p className="mt-8 text-lg">Email: <a className="underline underline-offset-4" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></p>
        ) : (
          <p className="mt-8 max-w-md border border-line p-4 text-steel">Customer contact details haven&apos;t been published yet. They&apos;ll appear here before launch. In the meantime, join the early-access list below.</p>
        )}
      </div>
      <div>
        <h2 className="eyebrow !text-bone">Early-access list</h2>
        <p className="mt-3 max-w-md text-steel">First notice of DROP 001 and product reveals.</p>
        <div className="mt-6 max-w-md"><NewsletterForm id="contact-email" /></div>
      </div>
    </div>
  );
}
