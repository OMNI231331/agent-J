import { cookies } from "next/headers";
import { checkoutGate, dropClock, dropPhase, EARLY_ACCESS_COOKIE, formatOpening, type DropPhase } from "./drop";

/** What a page needs to render the release state. Plain data, safe to pass to client components. */
export type DropView = {
  phase: DropPhase;
  /** epoch ms of public opening, or null when no date is set */
  opensAt: number | null;
  earlyAt: number | null;
  /** can this visitor check out right now (open, unscheduled, or holding a valid early-access pass) */
  canBuy: boolean;
  hasPass: boolean;
  opensLabel: string | null;
};

export async function getDropView(): Promise<DropView> {
  const clock = dropClock();
  const now = Date.now();
  const token = (await cookies()).get(EARLY_ACCESS_COOKIE)?.value ?? null;
  const gate = checkoutGate(clock, now, token);
  return {
    phase: dropPhase(clock, now),
    opensAt: clock.opensAt,
    earlyAt: clock.earlyAt,
    canBuy: gate.open,
    hasPass: gate.open && !!gate.passId,
    opensLabel: clock.opensAt ? formatOpening(clock.opensAt) : null,
  };
}
