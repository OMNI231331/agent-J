import { NextResponse } from "next/server";

// Forwards early-access sign-ups to EARLY_ACCESS_WEBHOOK_URL (a form or email-service endpoint that accepts JSON).
// With no webhook configured it answers 503 so the page never claims an email was saved when it was not.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let body: { email?: unknown; company?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: real visitors never fill this hidden field.
  if (body.company) return NextResponse.json({ ok: true });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const hook = process.env.EARLY_ACCESS_WEBHOOK_URL;
  if (!hook) {
    return NextResponse.json({ error: "Sign-ups aren't open yet. Please check back soon." }, { status: 503 });
  }
  const res = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source: "lsw-early-access", at: new Date().toISOString() }),
  }).catch(() => null);
  if (!res || !res.ok) {
    return NextResponse.json({ error: "We couldn't save your email. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
