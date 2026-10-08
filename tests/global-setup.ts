import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { TEST_REDIS_PORT } from "./helpers";

// The tests run the real Lua scripts against a real Redis server (redis-server must be installed).
let proc: ChildProcess | undefined;

const canConnect = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });

export async function setup() {
  proc = spawn("redis-server", ["--port", String(TEST_REDIS_PORT), "--bind", "127.0.0.1", "--save", "", "--appendonly", "no"], { stdio: "ignore" });
  proc.once("error", (e) => {
    throw new Error(`Could not start redis-server (is it installed?): ${e.message}`);
  });
  for (let i = 0; i < 100; i++) {
    if (await canConnect(TEST_REDIS_PORT)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("redis-server did not start");
}

export async function teardown() {
  proc?.kill();
}
