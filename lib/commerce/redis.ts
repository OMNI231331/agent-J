import { Redis } from "@upstash/redis";
import { InventoryStore, type RedisLike } from "./store.ts";

/**
 * Upstash over REST (works in Vercel serverless). Accepts either the Upstash names or the
 * names Vercel's Upstash integration injects. Server-only: these variables are never NEXT_PUBLIC.
 */
export function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let cached: InventoryStore | null | undefined;
export function getStore(): InventoryStore | null {
  if (cached !== undefined) return cached;
  const cfg = redisConfig();
  if (!cfg) return (cached = null);
  const client = new Redis({ ...cfg, automaticDeserialization: false });
  const adapter: RedisLike = { eval: (script, keys, args) => client.eval(script, keys, args) };
  return (cached = new InventoryStore(adapter));
}
