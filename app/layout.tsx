import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "LSW — Faith / Discipline / Purpose", template: "%s — LSW" },
  description: "LSW is premium limited-edition streetwear: heavyweight oversized silhouettes, original gothic-inspired graphics and crystal detailing. DROP 001.",
  openGraph: { siteName: "LSW", type: "website" },
};

// The page and Eve routes validate the generated app's Better Auth session.
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn(sans.variable, mono.variable, display.variable)} lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
