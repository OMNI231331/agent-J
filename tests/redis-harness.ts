// Test-only: a real redis-server + a tiny RESP client, so the production Lua scripts run for real.
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import type { RedisLike } from "../lib/commerce/store.ts";

type Reply = string | number | null | Reply[] | Error;

export class RespClient implements RedisLike {
  private sock: net.Socket;
  private buf = Buffer.alloc(0);
  private queue: { resolve: (v: Reply) => void; reject: (e: Error) => void }[] = [];
  constructor(port: number) {
    this.sock = net.createConnection({ port, host: "127.0.0.1" });
    this.sock.on("data", (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      for (;;) {
        const r = parse(this.buf, 0);
        if (!r) break;
        this.buf = this.buf.subarray(r.end);
        const p = this.queue.shift()!;
        r.value instanceof Error ? p.reject(r.value) : p.resolve(r.value);
      }
    });
  }
  ready() {
    return new Promise<void>((res, rej) => (this.sock.once("connect", () => res()), this.sock.once("error", rej)));
  }
  command(...args: string[]): Promise<Reply> {
    const parts = [`*${args.length}\r\n`, ...args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`)];
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.sock.write(parts.join(""));
    });
  }
  eval(script: string, keys: string[], args: string[]) {
    return this.command("EVAL", script, String(keys.length), ...keys, ...args) as Promise<unknown>;
  }
  close() {
    this.sock.end();
  }
}

function parse(b: Buffer, i: number): { value: Reply; end: number } | null {
  const nl = b.indexOf("\r\n", i);
  if (nl < 0) return null;
  const type = String.fromCharCode(b[i]);
  const line = b.toString("utf8", i + 1, nl);
  if (type === "+") return { value: line, end: nl + 2 };
  if (type === "-") return { value: new Error(line), end: nl + 2 };
  if (type === ":") return { value: Number(line), end: nl + 2 };
  if (type === "$") {
    const len = Number(line);
    if (len < 0) return { value: null, end: nl + 2 };
    if (b.length < nl + 2 + len + 2) return null;
    return { value: b.toString("utf8", nl + 2, nl + 2 + len), end: nl + 2 + len + 2 };
  }
  if (type === "*") {
    const n = Number(line);
    if (n < 0) return { value: null, end: nl + 2 };
    const out: Reply[] = [];
    let pos = nl + 2;
    for (let k = 0; k < n; k++) {
      const r = parse(b, pos);
      if (!r) return null;
      out.push(r.value);
      pos = r.end;
    }
    return { value: out, end: pos };
  }
  throw new Error(`unknown RESP type ${type}`);
}

export async function startRedis(): Promise<{ port: number; proc: ChildProcess; stop: () => void }> {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn("redis-server", ["--port", String(port), "--save", "", "--appendonly", "no", "--bind", "127.0.0.1"], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const c = new RespClient(port);
      await c.ready();
      c.close();
      return { port, proc, stop: () => proc.kill() };
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  proc.kill();
  throw new Error("redis-server did not start");
}
