import type { ReactNode } from "react";

// A template (unlike a layout) re-mounts on every navigation, so each storefront page fades in.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="lsw-page">{children}</div>;
}
