import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { RedisService } from '../redis/redis.service';
import { SecurityService } from '../../modules/security/security.service';
import { BlockType } from '../../modules/security/enums/block-type.enum';

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RedisRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly securityService: SecurityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    // Extract Client IP
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const clientIp = rawIp.replace(/^::ffff:/, ''); // Normalize IPv4-mapped IPv6

    // Extract Phone Number (if present in request body)
    const phoneNumber = (req.body?.phoneNumber as string) || null;

    // =========================================================================
    // STEP 1: CHECK MYSQL / REDIS BLOCKLIST (Fast ban enforcement)
    // =========================================================================
    const ipBlockCheck = await this.securityService.isTargetBlocked(clientIp, BlockType.IP);
    if (ipBlockCheck.blocked) {
      this.logger.warn(`⛔ Rejected blocked IP: ${clientIp} (Reason: ${ipBlockCheck.reason})`);
      throw new ForbiddenException(
        `Access denied. Your IP (${clientIp}) has been blocked. Reason: ${ipBlockCheck.reason}`,
      );
    }

    if (phoneNumber) {
      const phoneBlockCheck = await this.securityService.isTargetBlocked(phoneNumber, BlockType.PHONE);
      if (phoneBlockCheck.blocked) {
        this.logger.warn(`⛔ Rejected blocked Phone: ${phoneNumber} (Reason: ${phoneBlockCheck.reason})`);
        throw new ForbiddenException(
          `Access denied. Account for phone ${phoneNumber} has been blocked. Reason: ${phoneBlockCheck.reason}`,
        );
      }
    }

    // =========================================================================
    // STEP 2: DUAL-KEY RATE LIMITING (Evaluate IP & Phone in Redis)
    // =========================================================================
    const windowSeconds = options.windowSeconds || 60;
    const ipLimit = options.ipLimit || options.limit || 20;
    const phoneLimit = options.phoneLimit || options.limit || 5;
    const autoBlockMultiplier = options.autoBlockThresholdMultiplier || 3;
    const blockDurationMinutes = options.blockDurationMinutes || 60;

    // 1. IP check in Redis
    const ipKey = `rl:ip:${clientIp}:${options.prefix || req.path}`;
    const ipCheckPromise = this.redisService.checkRateLimit(ipKey, ipLimit, windowSeconds);

    // 2. Phone check in Redis (if phone present)
    let phoneCheckPromise = null;
    if (phoneNumber) {
      const phoneKey = `rl:phone:${phoneNumber}:${options.prefix || req.path}`;
      phoneCheckPromise = this.redisService.checkRateLimit(phoneKey, phoneLimit, windowSeconds);
    }

    // Execute in parallel
    const [ipResult, phoneResult] = await Promise.all([
      ipCheckPromise,
      phoneCheckPromise ? phoneCheckPromise : Promise.resolve(null),
    ]);

    // Attach headers
    const effectiveLimit = phoneResult ? phoneLimit : ipLimit;
    const effectiveRemaining = phoneResult
      ? Math.min(ipResult.remaining, phoneResult.remaining)
      : ipResult.remaining;

    res.setHeader('X-RateLimit-Limit', effectiveLimit);
    res.setHeader('X-RateLimit-Remaining', effectiveRemaining);

    // =========================================================================
    // STEP 3: HANDLE VIOLATION & AUTO-BLOCK AGGRESSIVE ATTACKERS
    // =========================================================================
    // Check if Phone limit failed
    if (phoneResult && !phoneResult.allowed) {
      const retryAfterSeconds = Math.ceil(phoneResult.retryAfterMs / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      // Check if violent brute-force (e.g. hit 3x the allowed attempts) -> Auto-ban into MySQL!
      if (phoneResult.currentCount >= phoneLimit * autoBlockMultiplier) {
        await this.securityService.blockTarget(
          phoneNumber,
          BlockType.PHONE,
          `Auto-blocked: Exceeded brute-force limit (${phoneResult.currentCount} attempts in ${windowSeconds}s)`,
          blockDurationMinutes,
        );
      }

      this.logger.warn(`Phone rate limit exceeded for ${phoneNumber}: ${phoneResult.currentCount}/${phoneLimit}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many attempts for phone number ${phoneNumber}. Please try again after ${retryAfterSeconds} seconds.`,
          retryAfterSeconds,
          target: 'PHONE',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check if IP limit failed
    if (!ipResult.allowed) {
      const retryAfterSeconds = Math.ceil(ipResult.retryAfterMs / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      // Check if violent DDoS / brute-force -> Auto-ban IP into MySQL!
      if (ipResult.currentCount >= ipLimit * autoBlockMultiplier) {
        await this.securityService.blockTarget(
          clientIp,
          BlockType.IP,
          `Auto-blocked: Exceeded IP DDoS limit (${ipResult.currentCount} requests in ${windowSeconds}s)`,
          blockDurationMinutes,
        );
      }

      this.logger.warn(`IP rate limit exceeded for ${clientIp}: ${ipResult.currentCount}/${ipLimit}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many requests from this IP. Please try again after ${retryAfterSeconds} seconds.`,
          retryAfterSeconds,
          target: 'IP',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
