// Every state change in the inventory is ONE Lua script, which Redis runs atomically.
// No other command can run between the stock check and the stock change inside a script,
// so two shoppers can never both buy the last unit.
//
// Reservation states: held -> paid | released.  late payment on a released reservation: released -> paid | refund_pending.
// Stock keys hold "units available to put in a bag". Reserving subtracts from them, releasing adds back,
// paying keeps the subtraction (the unit has been sold).
//
// release/sweep/reacquire read the stock key names from the reservation itself. That touches keys that are
// not declared in KEYS, which is fine on Upstash and any non-cluster Redis (do not move this to Redis Cluster).

export const RESERVE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return {'exists'} end
local items = cjson.decode(ARGV[3])
local short = {}
for i = 1, #items do
  local have = tonumber(redis.call('GET', KEYS[2 + i])) or 0
  if have < items[i].qty then short[#short + 1] = i end
end
if #short > 0 then return {'insufficient', unpack(short)} end
for i = 1, #items do redis.call('DECRBY', KEYS[2 + i], items[i].qty) end
redis.call('HSET', KEYS[1], 'state', 'held', 'items', ARGV[3], 'expiresAt', ARGV[2], 'subtotal', ARGV[4], 'createdAt', ARGV[5])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
return {'ok'}
`;

export const ATTACH_SESSION = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 'unknown' end
redis.call('HSET', KEYS[1], 'sessionId', ARGV[1])
return 'ok'
`;

export const GET_HASH = `return redis.call('HGETALL', KEYS[1])`;

export const COMMIT = `
local st = redis.call('HGET', KEYS[1], 'state')
if not st then return 'unknown' end
if st == 'paid' then return 'duplicate' end
if st == 'held' then
  redis.call('HSET', KEYS[1], 'state', 'paid', 'paidAt', ARGV[2])
  redis.call('ZREM', KEYS[2], ARGV[1])
  redis.call('SET', KEYS[3], ARGV[3], 'NX')
  redis.call('ZADD', KEYS[4], ARGV[2], ARGV[1])
  return 'committed'
end
return st
`;

export const RELEASE = `
local st = redis.call('HGET', KEYS[1], 'state')
if not st then return 'unknown' end
if st ~= 'held' then return st end
local items = cjson.decode(redis.call('HGET', KEYS[1], 'items'))
for i = 1, #items do redis.call('INCRBY', items[i].k, items[i].qty) end
redis.call('HSET', KEYS[1], 'state', 'released', 'releasedReason', ARGV[2], 'releasedAt', ARGV[3])
redis.call('ZREM', KEYS[2], ARGV[1])
return 'released_now'
`;

export const SWEEP = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
local out = {}
for _, id in ipairs(ids) do
  local rk = ARGV[3] .. id
  if redis.call('HGET', rk, 'state') == 'held' then
    local items = cjson.decode(redis.call('HGET', rk, 'items'))
    for i = 1, #items do redis.call('INCRBY', items[i].k, items[i].qty) end
    redis.call('HSET', rk, 'state', 'released', 'releasedReason', 'swept', 'releasedAt', ARGV[1])
    out[#out + 1] = id
  end
  redis.call('ZREM', KEYS[1], id)
end
return out
`;

// A payment arrived for a reservation that was already released. Take the stock back if it is still there.
export const REACQUIRE = `
local st = redis.call('HGET', KEYS[1], 'state')
if st ~= 'released' then return st or 'unknown' end
local items = cjson.decode(redis.call('HGET', KEYS[1], 'items'))
for i = 1, #items do
  local have = tonumber(redis.call('GET', items[i].k)) or 0
  if have < items[i].qty then return 'insufficient' end
end
for i = 1, #items do redis.call('DECRBY', items[i].k, items[i].qty) end
redis.call('HSET', KEYS[1], 'state', 'paid', 'paidAt', ARGV[2], 'lateRecovered', '1')
redis.call('SET', KEYS[3], ARGV[3], 'NX')
redis.call('ZADD', KEYS[4], ARGV[2], ARGV[1])
return 'recovered'
`;

// Paid, but the stock is gone: record the order as needing a refund.
export const MARK_REFUND = `
local st = redis.call('HGET', KEYS[1], 'state')
if st ~= 'released' then return st or 'unknown' end
redis.call('HSET', KEYS[1], 'state', 'refund_pending')
redis.call('SET', KEYS[2], ARGV[1], 'NX')
redis.call('ZADD', KEYS[3], ARGV[2], ARGV[3])
return 'recorded'
`;

export const CLAIM_EVENT = `
local v = redis.call('GET', KEYS[1])
if v then return v end
redis.call('SET', KEYS[1], 'processing', 'EX', ARGV[1])
return 'claimed'
`;
export const FINISH_EVENT = `redis.call('SET', KEYS[1], 'done', 'EX', ARGV[1]) return 'ok'`;
export const UNCLAIM_EVENT = `if redis.call('GET', KEYS[1]) == 'processing' then redis.call('DEL', KEYS[1]) end return 'ok'`;

export const RATE_LIMIT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
`;

export const MGET = `return redis.call('MGET', unpack(KEYS))`;
export const SET_STOCK = `redis.call('SET', KEYS[1], ARGV[1]) return tonumber(ARGV[1])`;
export const ADJUST_STOCK = `
local cur = tonumber(redis.call('GET', KEYS[1])) or 0
local n = cur + tonumber(ARGV[1])
if n < 0 then return -1 end
redis.call('SET', KEYS[1], n)
return n
`;
export const LIST_ORDERS = `
local ids = redis.call('ZREVRANGE', KEYS[1], 0, tonumber(ARGV[1]) - 1)
local out = {}
for _, id in ipairs(ids) do
  local o = redis.call('GET', ARGV[2] .. id)
  if o then out[#out + 1] = o end
end
return out
`;
