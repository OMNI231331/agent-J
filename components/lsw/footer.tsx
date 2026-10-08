import Link from "next/link";
import { Wordmark } from "./logo";
import { EarlyAccessForm } from "./early-access-form";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#070708] text-neutral-400">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Wordmark className="h-8 w-auto" />
          <p className="mt-4 max-w-xs text-sm">Faith / Discipline / Purpose.</p>
          <div className="mt-6">
            <EarlyAccessForm id="footer-signup" />
          </div>
        </div>
        <nav aria-label="Shop" className="text-sm">
          <h2 className="mb-4 text-xs uppercase tracking-[0.25em] text-neutral-200">Shop</h2>
          <ul className="space-y-2">
            <li><Link href="/shop">All products</Link></li>
            <li><Link href="/drop-001">Drop 001</Link></li>
            <li><Link href="/shipping-returns">Shipping and returns</Link></li>
          </ul>
        </nav>
        <nav aria-label="Company" className="text-sm">
          <h2 className="mb-4 text-xs uppercase tracking-[0.25em] text-neutral-200">LSW</h2>
          <ul className="space-y-2">
            <li><Link href="/about">Our story</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-7xl px-4 pb-10 text-xs text-neutral-400 sm:px-6">© {new Date().getFullYear()} LSW. All rights reserved.</p>
    </footer>
  );
}
