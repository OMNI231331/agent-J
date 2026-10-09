import { NextResponse } from "next/server";
import { clientIp } from "@/lib/commerce/client-ip";
import { getStore } from "@/lib/commerce/redis";

export const runtime = "nodejs";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Early-access sign-up. Stores contacts in a Resend Audience.
 * Requires RESEND_API_KEY + RESEND_AUDIENCE_ID. Without them this returns 503 —
 * we never report success for a sign-up that wasn't saved.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; company?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (body?.company) return NextResponse.json({ ok: true }); // honeypot: silently drop bots
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  // Stops a script from flooding the list (and burning email-provider quota): 5 sign-ups per IP per 10 minutes.
  try {
    const store = getStore();
    if (store && !(await store.allow(`subscribe:${clientIp(req.headers)}`, 5, 600)))
      return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  } catch (e) {
    console.error("subscribe: rate limiter unavailable", e instanceof Error ? e.message : e); // fail open: sign-ups matter more than the limiter
  }
  const key = process.env.RESEND_API_KEY;
  const audience = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audience) {
    return NextResponse.json({ error: "Sign-ups aren't open yet. Please check back soon." }, { status: 503 });
  }
  const res = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
