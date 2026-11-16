import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT, SLIDING_WINDOW_LUA_SCRIPT } from './redis.constants';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  currentCount: number;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  getClient(): Redis {
    return this.redisClient;
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    await this.redisClient.quit();
  }

  /**
   * Evaluates rate limiting using atomic Sliding Window Log Lua script.
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const member = `${now}:${Math.random().toString(36).substring(2, 9)}`;

    const res = (await this.redisClient.eval(
      SLIDING_WINDOW_LUA_SCRIPT,
      1,
      key,
      now.toString(),
      windowMs.toString(),
      limit.toString(),
      member,
    )) as [number, number, number, number];

    return {
      allowed: res[0] === 1,
      remaining: res[1],
      retryAfterMs: Math.max(0, res[2]),
      currentCount: res[3],
    };
  }

  // --- Common Redis Operations with type safety ---

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds && ttlSeconds > 0) {
      return this.redisClient.set(key, value, 'EX', ttlSeconds);
    }
    return this.redisClient.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return this.redisClient.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }
}
