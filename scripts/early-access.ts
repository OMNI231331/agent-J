// Generates signed early-access links for DROP 001.  Usage (reads .env.local if present):
//   pnpm early-access you@example.com friend@example.com      print one link per email (CSV: email,link)
//   pnpm early-access --file subscribers.txt                  one email per line (e.g. a Resend audience export)
//
// Each link works from DROP_EARLY_ACCESS_AT until public opening (NEXT_PUBLIC_LAUNCH_DATE), and allows a few
// checkout starts per person. Send them from your email tool; this script never sends anything itself.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dropClock, formatOpening, signPass } from "../lib/drop.ts";

const clock = dropClock();
const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
const problems = [
  !clock.opensAt && "NEXT_PUBLIC_LAUNCH_DATE must be a full ISO time with timezone, e.g. 2026-11-20T17:00:00-05:00",
  !clock.earlyAt && "DROP_EARLY_ACCESS_AT must be set, and earlier than NEXT_PUBLIC_LAUNCH_DATE",
  !clock.secret && "EARLY_ACCESS_SECRET must be at least 32 characters (e.g. `openssl rand -hex 32`)",
  !site && "NEXT_PUBLIC_SITE_URL must be set (the links point there)",
].filter(Boolean);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const fileAt = args.indexOf("--file");
const emails = (fileAt >= 0 ? readFileSync(args[fileAt + 1], "utf8").split(/[\s,;]+/) : args)
  .map((e) => e.trim().toLowerCase())
  .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
if (!emails.length) {
  console.error("No email addresses given. Usage: pnpm early-access a@b.com [c@d.com …] | --file list.txt");
  process.exit(1);
}

console.error(`Early access ${formatOpening(clock.earlyAt!)} → public ${formatOpening(clock.opensAt!)}. ${emails.length} link(s):`);
console.log("email,link");
for (const email of new Set(emails)) {
  // The pass carries a hash, not the address, so a forwarded link doesn't expose the subscriber.
  const id = createHash("sha256").update(email).digest("hex").slice(0, 20);
  console.log(`${email},${site}/early-access?t=${signPass(id, clock.opensAt!, clock.secret!)}`);
}
