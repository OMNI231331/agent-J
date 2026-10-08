"use client";

import { useState } from "react";

export function EarlyAccessForm({ id = "early-access" }: { id?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const company = (new FormData(e.currentTarget).get("company") as string) ?? "";
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setState("done");
        setMessage("You're on the list. We'll email you before Drop 001 opens.");
      } else {
        setState("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (state === "done") return <p className="text-sm text-neutral-200" role="status">{message}</p>;

  return (
    <form className="w-full max-w-md" id={id} noValidate onSubmit={submit}>
      <label className="sr-only" htmlFor={`${id}-email`}>
        Email address
      </label>
      <div className="flex gap-2">
        <input
          autoComplete="email"
          className="min-w-0 flex-1 border border-white/20 bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-400 focus:border-white/60 focus:outline-none"
          id={`${id}-email`}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          type="email"
          value={email}
        />
        {/* Honeypot: hidden from people, visible to bots. */}
        <input aria-hidden="true" autoComplete="off" className="hidden" name="company" tabIndex={-1} type="text" />
        <button className="bg-neutral-100 px-5 text-xs font-semibold uppercase tracking-[0.2em] text-black disabled:opacity-50" disabled={state === "loading"} type="submit">
          {state === "loading" ? "..." : "Join"}
        </button>
      </div>
      {message && (
        <p className="mt-3 text-xs text-neutral-300" role="alert">
          {message}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-400">Early-access updates about Drop 001 only. Unsubscribe any time.</p>
    </form>
  );
}
