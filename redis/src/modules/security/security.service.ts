import { Injectable, Logger } from '@nestjs/common';
import { BlockedTargetRepository } from './repositories/blocked-target.repository';
import { RedisService } from '../../common/redis/redis.service';
import { BlockType } from './enums/block-type.enum';
import { BlockedTarget } from './entities/blocked-target.entity';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly blockedTargetRepository: BlockedTargetRepository,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Fast check if IP or Phone is blocked.
   * Checks Redis cache first (<0.5ms); falls back to MySQL database.
   */
  async isTargetBlocked(target: string, type: BlockType): Promise<{ blocked: boolean; reason?: string }> {
    const cacheKey = `blocked:${type.toLowerCase()}:${target}`;

    // 1. Check Redis cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return { blocked: true, reason: cached };
    }

    // 2. Check MySQL Database
    const dbRecord = await this.blockedTargetRepository.findActiveBlock(target, type);
    if (dbRecord) {
      // Sync to Redis cache (cache for 60 seconds or until expiry)
      const ttl = dbRecord.expiresAt
        ? Math.max(10, Math.floor((dbRecord.expiresAt.getTime() - Date.now()) / 1000))
        : 300;
      await this.redisService.set(cacheKey, dbRecord.reason, ttl);

      return { blocked: true, reason: dbRecord.reason };
    }

    return { blocked: false };
  }

  /**
   * Block an IP or Phone number in both MySQL and Redis.
   */
  async blockTarget(
    target: string,
    type: BlockType,
    reason: string,
    durationMinutes?: number,
  ): Promise<BlockedTarget> {
    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;

    // 1. Persist to MySQL
    const saved = await this.blockedTargetRepository.blockTarget(
      target,
      type,
      reason,
      expiresAt,
    );

    // 2. Cache in Redis
    const cacheKey = `blocked:${type.toLowerCase()}:${target}`;
    const ttlSeconds = durationMinutes ? durationMinutes * 60 : 86400 * 30; // 30 days if permanent
    await this.redisService.set(cacheKey, reason, ttlSeconds);

    this.logger.warn(`🚨 BLOCKED ${type}: [${target}] | Reason: ${reason} | Expires: ${expiresAt || 'NEVER'}`);

    return saved;
  }

  /**
   * Unblock an IP or Phone in both MySQL and Redis.
   */
  async unblockTarget(target: string, type: BlockType): Promise<boolean> {
    // 1. Update in MySQL
    const updated = await this.blockedTargetRepository.unblockTarget(target, type);

    // 2. Invalidate Redis cache
    const cacheKey = `blocked:${type.toLowerCase()}:${target}`;
    await this.redisService.del(cacheKey);

    this.logger.log(`✅ UNBLOCKED ${type}: [${target}]`);
    return updated;
  }

  /**
   * List all blocked entries from database (for viewing/admin).
   */
  async getAllBlocked(): Promise<BlockedTarget[]> {
    return this.blockedTargetRepository.findAll();
  }
}
