import { NextResponse } from "next/server";
import { dropClock, dropPhase, EARLY_ACCESS_COOKIE, verifyPass } from "@/lib/drop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Landing URL for the signed links emailed to the early-access list (`pnpm early-access`).
 * A valid pass becomes an httpOnly cookie that the checkout API checks; the token never sits in page JS.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clock = dropClock();
  const now = Date.now();
  const back = (state: string) => NextResponse.redirect(new URL(`/drop-001?ea=${state}`, url.origin), 303);

  if (dropPhase(clock, now) === "open") return back("open");
  const token = url.searchParams.get("t");
  const pass = verifyPass(token, clock.secret, now);
  if (!pass || !token) return back("invalid");

  const res = back("ok");
  res.cookies.set(EARLY_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Math.floor((pass.exp - now) / 1000)),
  });
  // Keep the token out of browser history and analytics referrers.
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
