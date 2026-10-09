"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Wordmark } from "./logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/drop-001", label: "Drop 001" },
  { href: "/our-story", label: "Our Story" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const { count, setOpen } = useCart();
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menu]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink">
      <div className="container-lsw flex h-16 items-center justify-between">
        <button aria-controls="mobile-nav" aria-expanded={menu} aria-label={menu ? "Close menu" : "Open menu"} className="-ml-2 grid h-11 w-11 place-items-center md:hidden" onClick={() => setMenu(!menu)} type="button">
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {links.slice(0, 3).map((l) => (
            <Link aria-current={active(l.href) ? "page" : undefined} className={`eyebrow transition-colors hover:text-bone ${active(l.href) ? "!text-bone" : ""}`} href={l.href} key={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link aria-label="LSW — home" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" href="/">
          <Wordmark className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-8">
          <nav aria-label="Secondary" className="hidden items-center gap-8 md:flex">
            {links.slice(3).map((l) => (
              <Link aria-current={active(l.href) ? "page" : undefined} className={`eyebrow transition-colors hover:text-bone ${active(l.href) ? "!text-bone" : ""}`} href={l.href} key={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <button aria-label={`Open bag, ${count} ${count === 1 ? "item" : "items"}`} className="relative -mr-2 grid h-11 w-11 place-items-center" onClick={() => setOpen(true)} type="button">
            <ShoppingBag size={21} />
            {count > 0 && (
              <span aria-hidden className="absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center bg-bone px-1 font-mono text-[10px] text-ink">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
      {menu && (
        <nav aria-label="Mobile" className="fixed inset-0 z-30 overflow-auto bg-ink pt-28 md:hidden" id="mobile-nav">
          <ul className="container-lsw py-6">
            {links.map((l) => (
              <li className="border-b border-line" key={l.href}>
                <Link aria-current={active(l.href) ? "page" : undefined} className="display flex min-h-16 items-center justify-between text-4xl" href={l.href}>
                  {l.label}
                  <span className="eyebrow">{active(l.href) ? "●" : "→"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
