import Link from "next/link";
import { site } from "@/lib/site";
import { Monogram, Wordmark } from "./logo";
import { NewsletterForm } from "./newsletter-form";

const cols = [
  { title: "Shop", links: [["All products", "/shop"], ["Drop 001", "/drop-001"], ["Hoodies", "/shop?category=Hoodies"], ["Tees", "/shop?category=Tees"]] },
  { title: "LSW", links: [["Our story", "/our-story"], ["Contact", "/contact"], ["Brand system", "/brand"]] },
  { title: "Help", links: [["Shipping & returns", "/shipping-returns"], ["Privacy policy", "/privacy"], ["Terms", "/terms"]] },
] as const;

export function Footer() {
  const socials = Object.entries(site.social).filter(([, url]) => url) as [string, string][];
  return (
    <footer className="mt-24 border-t border-line bg-coal">
      <div className="container-lsw grid gap-12 py-16 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <Wordmark className="h-8 w-auto" />
          <p className="eyebrow mt-4">Faith / Discipline / Purpose</p>
          <div className="mt-8 max-w-sm">
            <p className="mb-3 text-sm text-steel">Early-access list: first notice of DROP 001, product reveals, and nothing else.</p>
            <NewsletterForm compact id="footer-email" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {cols.map((c) => (
            <nav aria-label={c.title} key={c.title}>
              <h2 className="eyebrow !text-bone">{c.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-steel">
                {c.links.map(([label, href]) => (
                  <li key={label}><Link className="hover:text-bone" href={href}>{label}</Link></li>
                ))}
                {c.title === "LSW" && socials.map(([name, url]) => (
                  <li key={name}><a className="capitalize hover:text-bone" href={url} rel="noopener noreferrer" target="_blank">{name}</a></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-lsw flex flex-col gap-3 py-6 text-xs text-steel sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-3"><Monogram className="h-5 w-5" mono /> © {new Date().getFullYear()} LSW. All rights reserved.</span>
          <span>Product images are concept renders until photography is published.</span>
        </div>
      </div>
    </footer>
  );
}
