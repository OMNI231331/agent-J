import type { ReactNode } from "react";
import { CartProvider } from "@/components/lsw/cart-provider";
import { CartDrawer } from "@/components/lsw/cart-drawer";
import { Footer } from "@/components/lsw/footer";
import { Header } from "@/components/lsw/header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="lsw-site min-h-screen bg-[#0a0a0b] text-neutral-100 antialiased">
        <div className="bg-neutral-100 px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-black">
          LSW Drop 001: preview. Join the early-access list
        </div>
        <Header />
        <main>{children}</main>
        <Footer />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
