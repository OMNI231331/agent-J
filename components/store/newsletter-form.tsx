"use client";

import { useState } from "react";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "done" } | { kind: "error"; message: string };

export function NewsletterForm({ compact = false, id = "early-access-email" }: { compact?: boolean; id?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [email, setEmail] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setState({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company: form.get("company") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setState({ kind: "done" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  if (state.kind === "done") {
    return <p className="border border-line p-4 text-sm" role="status">You&apos;re on the list. We&apos;ll email you before DROP 001 opens.</p>;
  }
  return (
    <form className="w-full" noValidate onSubmit={submit}>
      <label className={compact ? "sr-only" : "eyebrow mb-2 block"} htmlFor={id}>Email address</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input aria-describedby={`${id}-err`} aria-invalid={state.kind === "error"} autoComplete="email" className="field" id={id} inputMode="email" name="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" value={email} />
        {/* honeypot */}
        <input aria-hidden autoComplete="off" className="hidden" name="company" tabIndex={-1} type="text" />
        <button className="btn shrink-0" disabled={state.kind === "loading"} type="submit">{state.kind === "loading" ? "Joining…" : "Join"}</button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-alert" id={`${id}-err`} role={state.kind === "error" ? "alert" : undefined}>
        {state.kind === "error" ? state.message : ""}
      </p>
    </form>
  );
}
