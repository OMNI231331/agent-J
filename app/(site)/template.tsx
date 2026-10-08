import type { ReactNode } from "react";

// A template (unlike a layout) re-mounts on every navigation, so this fades each new page in.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="lsw-page">{children}</div>;
}
