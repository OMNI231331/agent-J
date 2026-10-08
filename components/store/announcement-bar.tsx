import Link from "next/link";
import { site } from "@/lib/site";

export function AnnouncementBar() {
  return (
    <div className="border-b border-line bg-coal">
      <p className="eyebrow container-lsw py-2.5 text-center">
        <Link className="hover:text-bone" href="/#early-access">
          LSW DROP 001 — JOIN THE EARLY-ACCESS LIST
        </Link>
        {site.mode === "preview" && <span className="hidden sm:inline"> · PREVIEW — PRICES &amp; AVAILABILITY ARE DRAFT</span>}
      </p>
    </div>
  );
}
