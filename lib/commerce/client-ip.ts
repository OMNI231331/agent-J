/**
 * Best-effort client IP for rate limiting. On Vercel, `x-vercel-forwarded-for` and `x-real-ip` are set by the
 * platform and can't be supplied by the visitor, so they're preferred. A raw `x-forwarded-for` is only a fallback
 * (it can be spoofed on other hosts) — rate limiting is a speed bump there, not a guarantee.
 */
export function clientIp(headers: Pick<Headers, "get">): string {
  const trusted = headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip");
  const raw = trusted ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ip = raw.trim().slice(0, 64);
  return ip || "unknown";
}
