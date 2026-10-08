import { Redis } from "@upstash/redis";
import { InventoryStore, type RedisLike } from "./store";

let cached: InventoryStore | null | undefined;

function upstashAdapter(url: string, token: string): RedisLike {
  // automaticDeserialization is OFF: our scripts return plain strings and JSON text that must stay exactly as written.
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return { eval: (script, keys, args) => redis.eval(script, keys, args) };
}

/** Returns the store, or null when Redis isn't configured (the site then stays in preview mode). Server only. */
export function getStore(): InventoryStore | null {
  if (cached !== undefined) return cached;
  // Vercel's Upstash integration sets KV_REST_API_*; a manual Upstash setup uses UPSTASH_REDIS_REST_*.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  cached = url && token ? new InventoryStore(upstashAdapter(url, token)) : null;
  return cached;
}

/** Tests only. */
export function __setStoreForTests(store: InventoryStore | null | undefined) {
  cached = store;
}

export { InventoryStore } from "./store";
export type { RedisLike } from "./store";
