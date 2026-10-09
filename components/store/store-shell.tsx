import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart";
import { AnnouncementBar } from "./announcement-bar";
import { CartDrawer } from "./cart-drawer";
import { Footer } from "./footer";
import { Header } from "./header";

/** The store's page chrome (announcement bar, header, footer, bag). Used by the store layout and the 404 page. */
export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="lsw">
        <a className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:bg-bone focus:px-4 focus:py-2 focus:text-ink" href="#main">
          Skip to content
        </a>
        <AnnouncementBar />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
