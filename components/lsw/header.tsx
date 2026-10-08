"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { Wordmark } from "./logo";
import { useCart } from "./cart-provider";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/drop-001", label: "Drop 001" },
  { href: "/about", label: "Our Story" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [menu, setMenu] = useState(false);
  const { count, setOpen } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0a0b]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link aria-label="LSW home" href="/" onClick={() => setMenu(false)}>
          <Wordmark className="h-7 w-auto" />
        </Link>
        <nav aria-label="Main" className="hidden gap-8 text-xs uppercase tracking-[0.2em] text-neutral-300 md:flex">
          {links.map((l) => (
            <Link className="relative py-1 hover:text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-neutral-200 after:transition-transform after:duration-300 hover:after:scale-x-100" href={l.href} key={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <button aria-label={`Open bag, ${count} item${count === 1 ? "" : "s"}`} className="relative p-2 text-neutral-200 hover:text-white" onClick={() => setOpen(true)} type="button">
            <ShoppingBag size={20} />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-200 px-1 text-[10px] font-semibold text-black">{count}</span>}
          </button>
          <button aria-expanded={menu} aria-label={menu ? "Close menu" : "Open menu"} className="p-2 text-neutral-200 md:hidden" onClick={() => setMenu((m) => !m)} type="button">
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menu && (
        <nav aria-label="Mobile" className="animate-[lsw-drop-in_260ms_cubic-bezier(0.22,1,0.36,1)] border-t border-white/10 px-4 py-4 md:hidden">
          {links.map((l) => (
            <Link className="block py-3 text-sm uppercase tracking-[0.2em] text-neutral-200" href={l.href} key={l.href} onClick={() => setMenu(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
