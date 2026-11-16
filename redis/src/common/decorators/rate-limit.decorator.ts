import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';

export const RATE_LIMIT_KEY = 'RATE_LIMIT_METADATA';

export interface RateLimitOptions {
  /** Maximum number of allowed requests in the time window (default/general limit) */
  limit?: number;
  /** Custom separate rate limit per IP address (e.g. 20 requests/minute) */
  ipLimit?: number;
  /** Custom separate rate limit per Phone number (e.g. 5 requests/minute) */
  phoneLimit?: number;
  /** Sliding window duration in seconds */
  windowSeconds?: number;
  /** Optional custom prefix for the Redis key */
  prefix?: string;
  /** Optional custom key generator function */
  keyGenerator?: (req: Request) => string;
  /**
   * If a client violates the limit by this multiplier (e.g., 3x limit),
   * automatically insert their IP/Phone into the MySQL blocklist table!
   */
  autoBlockThresholdMultiplier?: number;
  /** Duration in minutes to block violators in DB (e.g. 60 min, or undefined for permanent) */
  blockDurationMinutes?: number;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
