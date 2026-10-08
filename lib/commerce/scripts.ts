/**
 * Lua scripts run atomically inside Redis. Every key a script touches is passed in KEYS
 * (no dynamic key construction), and no cjson is used, so they run on Upstash and plain Redis.
 *
 * Reservation hash fields: status, lines ("SKU:qty|SKU:qty"), expiresAt (ms), sessionId, reason.
 * Status flow: reserved -> committed | released ; reserved -> awaiting_payment -> committed | released.
 * A late payment on a released reservation re-takes stock if possible ("recommitted"), else
 * the order is flagged ("committed_oversold") for a manual refund.
 */

/** KEYS: res, expiryIndex, inv... | ARGV: resId, expiresAtMs, lines, qty... */
export const RESERVE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return {-1} end
for i = 3, #KEYS do
  local v = redis.call('GET', KEYS[i])
  if not v then return {0, i - 2, -1} end
  if tonumber(v) < tonumber(ARGV[i + 1]) then return {0, i - 2, tonumber(v)} end
end
for i = 3, #KEYS do redis.call('DECRBY', KEYS[i], ARGV[i + 1]) end
redis.call('HSET', KEYS[1], 'status', 'reserved', 'lines', ARGV[3], 'expiresAt', ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
return {1}
`;

/** KEYS: res, expiryIndex, inv... | ARGV: resId, lines, reason, terminalTtlSec, qty... */
export const RELEASE = `
local st = redis.call('HGET', KEYS[1], 'status')
if not st then return 'missing' end
if st ~= 'reserved' and st ~= 'awaiting_payment' then return 'noop:' .. st end
if redis.call('HGET', KEYS[1], 'lines') ~= ARGV[2] then return 'mismatch' end
for i = 3, #KEYS do redis.call('INCRBY', KEYS[i], ARGV[i + 2]) end
redis.call('HSET', KEYS[1], 'status', 'released', 'reason', ARGV[3])
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 'released'
`;

/** KEYS: res, expiryIndex, inv... | ARGV: resId, lines, terminalTtlSec, qty... */
export const COMMIT = `
local st = redis.call('HGET', KEYS[1], 'status')
if not st then return 'missing' end
if st == 'committed' or st == 'committed_oversold' then return 'already:' .. st end
if redis.call('HGET', KEYS[1], 'lines') ~= ARGV[2] then return 'mismatch' end
if st == 'reserved' or st == 'awaiting_payment' then
  redis.call('HSET', KEYS[1], 'status', 'committed')
  redis.call('ZREM', KEYS[2], ARGV[1])
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  return 'committed'
end
if st == 'released' then
  for i = 3, #KEYS do
    local v = tonumber(redis.call('GET', KEYS[i]) or '0')
    if v < tonumber(ARGV[i + 1]) then
      redis.call('HSET', KEYS[1], 'status', 'committed_oversold')
      redis.call('EXPIRE', KEYS[1], ARGV[3])
      return 'oversold'
    end
  end
  for i = 3, #KEYS do redis.call('DECRBY', KEYS[i], ARGV[i + 1]) end
  redis.call('HSET', KEYS[1], 'status', 'committed')
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  return 'recommitted'
end
return 'unknown:' .. st
`;

/** KEYS: res, expiryIndex | ARGV: resId — async payment pending: keep stock held, stop the sweeper. */
export const MARK_AWAITING = `
local st = redis.call('HGET', KEYS[1], 'status')
if st ~= 'reserved' then return 'noop:' .. tostring(st) end
redis.call('HSET', KEYS[1], 'status', 'awaiting_payment')
redis.call('ZREM', KEYS[2], ARGV[1])
return 'awaiting_payment'
`;

/** KEYS: order, orderIndex | ARGV: sessionId, status, rank, nowMs, details — never moves an order backwards. */
export const ORDER_UPSERT = `
local cur = tonumber(redis.call('HGET', KEYS[1], 'rank') or '0')
if tonumber(ARGV[3]) < cur then return 0 end
redis.call('HSET', KEYS[1], 'status', ARGV[2], 'rank', ARGV[3], 'details', ARGV[5], 'updatedAt', ARGV[4])
redis.call('HSETNX', KEYS[1], 'createdAt', ARGV[4])
redis.call('ZADD', KEYS[2], 'NX', ARGV[4], ARGV[1])
return 1
`;

export const HSET = `redis.call('HSET', KEYS[1], unpack(ARGV)) return 1`;
export const HGETALL = `return redis.call('HGETALL', KEYS[1])`;
export const MGET = `return redis.call('MGET', unpack(KEYS))`;
export const GET = `return redis.call('GET', KEYS[1])`;
/** KEYS: key | ARGV: value, ttlSec — returns 1 if set, 0 if it already existed. */
export const SET_NX_EX = `if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end return 0`;
/** KEYS: expiryIndex | ARGV: nowMs, limit */
export const DUE = `return redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])`;
/** KEYS: inv... | ARGV: counts... — absolute SET, used only by the inventory admin script. */
/** KEYS: expiryIndex | ARGV: resId */
export const ZREM = `return redis.call('ZREM', KEYS[1], ARGV[1])`;
/** KEYS: inv... | ARGV: counts... — absolute SET, used only by the inventory admin script. */
export const SET_STOCK = `for i = 1, #KEYS do redis.call('SET', KEYS[i], ARGV[i]) end return #KEYS`;

/** KEYS: inv | ARGV: delta — relative restock/correction that refuses to go below zero. Returns the new count, or -1 if refused. */
export const ADJUST = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local nxt = cur + tonumber(ARGV[1])
if nxt < 0 then return -1 end
redis.call('SET', KEYS[1], nxt)
return nxt
`;

/** KEYS: orderIndex | ARGV: limit — newest first. */
export const RECENT_ORDERS = `return redis.call('ZREVRANGE', KEYS[1], 0, tonumber(ARGV[1]) - 1)`;

/** KEYS: counter | ARGV: windowSec — fixed-window counter; returns the count including this call. */
export const RATE_HIT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
`;
