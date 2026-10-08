// Test-only: speaks Upstash's REST protocol on top of a local redis-server, so the real
// @upstash/redis client (and the real Next.js routes) can be exercised offline.
import http from "node:http";
import { RespClient } from "./redis-harness.ts";

const enc = (v: unknown): unknown => (typeof v === "string" ? (v === "OK" ? v : Buffer.from(v, "utf8").toString("base64")) : Array.isArray(v) ? v.map(enc) : v);

export async function startUpstashShim(redisPort: number, token: string) {
  const redis = new RespClient(redisPort);
  await redis.ready();
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      res.setHeader("content-type", "application/json");
      if (req.headers.authorization !== `Bearer ${token}`) return void res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
      const b64 = req.headers["upstash-encoding"] === "base64";
      const run = async (cmd: unknown[]) => {
        try {
          const result = await redis.command(...cmd.map(String));
          return { result: b64 ? enc(result) : result };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      };
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as unknown[];
        const batch = Array.isArray(body[0]); // /pipeline and /multi-exec send a list of commands
        const out = batch ? [] as object[] : null;
        if (batch) for (const c of body as unknown[][]) out!.push(await run(c));
        const single = batch ? null : await run(body);
        if (!batch && "error" in single!) return void res.writeHead(400).end(JSON.stringify(single));
        res.end(JSON.stringify(batch ? out : single));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, close: () => (server.close(), redis.close()) };
}
