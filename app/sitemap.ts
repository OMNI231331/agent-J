import type { MetadataRoute } from "next";
import { products } from "@/lib/catalog";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/shop", "/drop-001", "/our-story", "/contact", "/shipping-returns", "/privacy", "/terms"];
  return [
    ...pages.map((p) => ({ url: `${site.url}${p}` })),
    ...products.map((p) => ({ url: `${site.url}/products/${p.slug}` })),
  ];
}
