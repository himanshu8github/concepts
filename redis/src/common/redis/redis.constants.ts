export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Sliding Window Rate Limiter Lua Script
 * KEYS[1]: Rate limit key (e.g., rl:auth:login:127.0.0.1)
 * ARGV[1]: Current timestamp in milliseconds (now)
 * ARGV[2]: Window size in milliseconds
 * ARGV[3]: Max allowed requests in window
 * ARGV[4]: Unique member identifier (e.g., now:nonce)
 *
 * Returns:
 * [allowed (1 or 0), remaining_requests, retry_after_ms, current_count]
 */
export const SLIDING_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local clear_before = now - window

-- 1. Remove entries outside the current sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clear_before)

-- 2. Count requests currently in the window
local current_count = redis.call('ZCARD', key)

if current_count < limit then
    -- Allowed: record current request timestamp
    redis.call('ZADD', key, now, member)
    -- Set TTL to ensure key cleans itself up if traffic stops
    redis.call('PEXPIRE', key, window)
    local remaining = limit - (current_count + 1)
    return {1, remaining, 0, current_count + 1}
else
    -- Blocked: calculate retry_after_ms based on the oldest record in current window
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = 0
    if #oldest > 0 then
        local oldest_time = tonumber(oldest[2])
        retry_after = (oldest_time + window) - now
        if retry_after < 0 then
            retry_after = 0
        end
    else
        retry_after = window
    end
    return {0, 0, retry_after, current_count}
end
`;
