import Image from "next/image";
import type { ColorId, Product } from "@/lib/catalog";
import { GarmentArt, type ArtView } from "./garment-art";

/** Uses real photography when the product has it for this view; otherwise a clearly-labelled concept render. */
export function ProductArt({ product, color, view, className }: { product: Product; color: ColorId; view: ArtView; className?: string }) {
  const photo = product.photos?.find((p) => p.kind === view);
  if (photo) return <Image alt={photo.alt} className={className} height={1000} src={photo.src} style={{ objectFit: "cover" }} width={800} />;
  return <GarmentArt className={className} color={color} garment={product.garment} level={product.level} view={view} />;
}
