// Edit this file to change the brand name and the product catalog.
export const brand = {
  name: "NORTHLINE",
  tagline: "Everyday clothing, made to last.",
  email: "hello@example.com",
};

export type Product = {
  id: string;
  name: string;
  category: "Tops" | "Bottoms" | "Outerwear" | "Accessories";
  price: number;
  description: string;
  /** CSS background used as the product image placeholder. */
  swatch: string;
};

export const products: Product[] = [
  { id: "heavy-tee", name: "Heavyweight Tee", category: "Tops", price: 38, description: "240gsm organic cotton, boxy fit.", swatch: "linear-gradient(135deg,#e7e2d8,#c9c1b0)" },
  { id: "crew-hoodie", name: "Classic Hoodie", category: "Tops", price: 78, description: "Brushed fleece, double-lined hood.", swatch: "linear-gradient(135deg,#3b4252,#1f2430)" },
  { id: "pocket-longsleeve", name: "Pocket Long Sleeve", category: "Tops", price: 52, description: "Soft jersey with a chest pocket.", swatch: "linear-gradient(135deg,#8a9a7b,#5d6c52)" },
  { id: "relaxed-jeans", name: "Relaxed Jeans", category: "Bottoms", price: 92, description: "Rigid denim, relaxed straight leg.", swatch: "linear-gradient(135deg,#4a6285,#2c3e5c)" },
  { id: "jogger", name: "Everyday Joggers", category: "Bottoms", price: 64, description: "Tapered, stretch french terry.", swatch: "linear-gradient(135deg,#9c9c9c,#6f6f6f)" },
  { id: "coach-jacket", name: "Coach Jacket", category: "Outerwear", price: 120, description: "Water-resistant shell, snap front.", swatch: "linear-gradient(135deg,#c06a3c,#8c4423)" },
  { id: "puffer", name: "Light Puffer", category: "Outerwear", price: 160, description: "Recycled fill, packs into its pocket.", swatch: "linear-gradient(135deg,#222,#0c0c0c)" },
  { id: "dad-cap", name: "Washed Cap", category: "Accessories", price: 28, description: "Six-panel cotton twill, adjustable.", swatch: "linear-gradient(135deg,#d9b66a,#b08d3f)" },
];
