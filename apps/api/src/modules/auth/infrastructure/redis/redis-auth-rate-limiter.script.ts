export const AUTH_RATE_LIMIT_TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local should_consume = tonumber(ARGV[3])

local redis_time = redis.call("TIME")
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
local state = redis.call("HMGET", key, "tokens", "updated_at_ms", "limited")
local tokens = tonumber(state[1]) or capacity
local updated_at_ms = tonumber(state[2]) or now_ms
local was_limited = tonumber(state[3]) or 0
local elapsed_ms = math.max(0, now_ms - updated_at_ms)
local refill_rate = capacity / window_ms

tokens = math.min(capacity, tokens + (elapsed_ms * refill_rate))

local allowed = 0
if tokens >= 1 then
  allowed = 1
  if should_consume == 1 then
    tokens = tokens - 1
  end
end

local limited = 0
local became_limited = 0
local retry_after_seconds = 0

if allowed == 0 then
  limited = 1
  if was_limited == 0 then
    became_limited = 1
  end
  retry_after_seconds = math.max(1, math.ceil(((1 - tokens) / refill_rate) / 1000))
end

redis.call(
  "HSET",
  key,
  "tokens",
  string.format("%.6f", tokens),
  "updated_at_ms",
  now_ms,
  "limited",
  limited
)
redis.call("PEXPIRE", key, math.ceil(window_ms * 2))

return { allowed, retry_after_seconds, became_limited }
`;
