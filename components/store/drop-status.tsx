import type { DropView } from "@/lib/drop-server";
import { Countdown } from "./countdown";

/** Release state for DROP 001, drawn only from the server clock. Nothing here is shown unless it is true. */
export function DropStatus({ drop, compact = false }: { drop: DropView; compact?: boolean }) {
  if (drop.phase === "unscheduled" || !drop.opensAt || !drop.opensLabel)
    return <p className="eyebrow !text-bone">Release date to be announced — join the early-access list</p>;
  if (drop.phase === "open") return <p className="eyebrow !text-bone">Now open · Released {drop.opensLabel}</p>;
  return (
    <div className="space-y-4">
      <Countdown compact={compact} label={`Public release · ${drop.opensLabel}`} to={drop.opensAt} />
      {drop.phase === "early" && (
        <p className="max-w-md border-l border-silver pl-3 text-sm text-silver">
          {drop.hasPass ? "Your early access is active — checkout is open for you now." : "Early access is open for list members, via the link in their email."}
        </p>
      )}
    </div>
  );
}

const EA_MESSAGES: Record<string, string> = {
  ok: "Early access unlocked on this device. Checkout opens for you during the early-access window.",
  invalid: "That early-access link isn't valid or has expired. Use the newest link from your email.",
  open: "DROP 001 is now open to everyone — no link needed.",
};

export function EarlyAccessNotice({ state }: { state?: string }) {
  const msg = state ? EA_MESSAGES[state] : undefined;
  if (!msg) return null;
  return (
    <p className={`border px-4 py-3 text-sm ${state === "invalid" ? "border-alert/50 text-alert" : "border-silver/50 text-bone"}`} role="status">
      {msg}
    </p>
  );
}
