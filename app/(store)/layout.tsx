import type { ReactNode } from "react";
import { StoreShell } from "@/components/store/store-shell";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}
