import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * DROP 001 release clock and early-access passes.
 *
 * One fixed, server-side release time (NEXT_PUBLIC_LAUNCH_DATE, a full ISO timestamp with timezone).
 * Before it, checkout is refused server-side. Early-access subscribers get a signed link that unlocks
 * checkout from DROP_EARLY_ACCESS_AT until public opening. The clock never resets: every visitor sees
 * a countdown to the same absolute instant, and an unset date means "no clock" (nothing is implied).
 */

export type DropClock = {
  /** Public opening, epoch ms. null = no date set: the store behaves as before (no gate, no countdown). */
  opensAt: number | null;
  /** When early-access links start working, epoch ms. null = no early window. */
  earlyAt: number | null;
  /** HMAC key for early-access passes. Without it, no pass is ever valid. */
  secret: string | null;
};

export type DropPhase = "unscheduled" | "upcoming" | "early" | "open";

export const EARLY_ACCESS_COOKIE = "lsw_ea";

/** Accepts only a full timestamp with an explicit timezone, so "the time" can't silently shift with the server's locale. */
export function parseInstant(value: string | null | undefined): number | null {
  const v = value?.trim();
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function dropClock(env: Record<string, string | undefined> = process.env): DropClock {
  const opensAt = parseInstant(env.NEXT_PUBLIC_LAUNCH_DATE);
  const earlyAt = parseInstant(env.DROP_EARLY_ACCESS_AT);
  const secret = env.EARLY_ACCESS_SECRET && env.EARLY_ACCESS_SECRET.length >= 32 ? env.EARLY_ACCESS_SECRET : null;
  return {
    opensAt,
    // An early window only makes sense before a real opening time.
    earlyAt: opensAt !== null && earlyAt !== null && earlyAt < opensAt ? earlyAt : null,
    secret,
  };
}

export function dropPhase(clock: DropClock, now: number): DropPhase {
  if (clock.opensAt === null) return "unscheduled";
  if (now >= clock.opensAt) return "open";
  if (clock.earlyAt !== null && now >= clock.earlyAt) return "early";
  return "upcoming";
}

// ---------- early-access passes ----------

type PassPayload = { id: string; exp: number };

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(`lsw-ea.${body}`).digest("base64url");

/** `id` should be stable per subscriber (e.g. a hash of their email) so use can be rate-limited per person. */
export function signPass(id: string, exp: number, secret: string): string {
  const body = b64(JSON.stringify({ id, exp } satisfies PassPayload));
  return `${body}.${sign(body, secret)}`;
}

export function verifyPass(token: string | null | undefined, secret: string | null, now: number): PassPayload | null {
  if (!token || !secret || token.length > 512) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body, secret));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as PassPayload;
    if (typeof p.id !== "string" || !p.id || typeof p.exp !== "number" || p.exp <= now) return null;
    return p;
  } catch {
    return null;
  }
}

export function readCookie(header: string | null, name: string): string | null {
  for (const part of header?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export type Gate = { open: true; passId?: string } | { open: false; phase: DropPhase; opensAt: number };

/** The single decision both the checkout API and the product page use. */
export function checkoutGate(clock: DropClock, now: number, passToken: string | null): Gate {
  const phase = dropPhase(clock, now);
  if (phase === "unscheduled" || phase === "open") return { open: true };
  if (phase === "early") {
    const pass = verifyPass(passToken, clock.secret, now);
    if (pass) return { open: true, passId: pass.id };
  }
  return { open: false, phase, opensAt: clock.opensAt! };
}

export function formatOpening(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(ms);
}
