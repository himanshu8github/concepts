import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  IdempotencyKey,
  IdempotencyStatus,
} from '../../database/entities/idempotency-key.entity';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // 1. Extract Idempotency-Key from headers (MANDATORY)
    const rawKey =
      req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    // Reject request if Idempotency-Key is missing
    if (!rawKey) {
      throw new BadRequestException(
        'Missing mandatory Idempotency-Key header.',
      );
    }

    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const endpoint = req.originalUrl || req.url;

    // 2. Resolve Authenticated User ID:
    // Priority:
    // 1) Authenticated context: req.user.id
    // 2) Client header: req.headers['x-user-id']
    // 3) Request body: req.body.userId
    // 4) Fallback: 'anonymous'
    const headerUserId = req.headers['x-user-id'];
    const userId = req.user?.id
      ? String(req.user.id)
      : headerUserId
        ? String(Array.isArray(headerUserId) ? headerUserId[0] : headerUserId)
        : req.body?.userId
          ? String(req.body.userId)
          : 'anonymous';

    // 3. Hash request payload (SHA-256) to ensure exact body matching
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    // 4. Scoped Lookup: (userId, endpoint, key)
    // Prevents cross-user collisions: User B's lookup can NEVER match User A's row!
    let record = await this.idempotencyRepo.findOne({
      where: { userId, endpoint, key },
    });

    if (record) {
      // Rule: Same user, same key, different body -> 400 Bad Request
      if (record.requestPayloadHash !== payloadHash) {
        throw new BadRequestException('Invalid request parameters');
      }

      // If already COMPLETED: replay the exact cached response (Pure Idempotency)
      if (record.status === IdempotencyStatus.COMPLETED) {
        res.status(record.statusCode || 200);
        res.setHeader('X-Cache-Lookup', 'HIT - Replayed Idempotent Response');
        return of(record.responseBody);
      }

      // If still STARTED: another concurrent request is currently in-flight
      // Returns generic message without leaking sensitive system details
      if (record.status === IdempotencyStatus.STARTED) {
        throw new ConflictException(
          'Request currently in progress. Please retry shortly.',
        );
      }
    }

    // 5. Atomically insert row with status STARTED scoped to (userId, endpoint, key)
    try {
      record = this.idempotencyRepo.create({
        userId,
        endpoint,
        key,
        requestPayloadHash: payloadHash,
        status: IdempotencyStatus.STARTED,
      });
      record = await this.idempotencyRepo.save(record);
    } catch (err) {
      // Handles concurrent race conditions hitting at the exact same millisecond
      if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('duplicate')) {
        throw new ConflictException(
          'Request currently in progress. Please retry shortly.',
        );
      }
      throw err;
    }

    // 6. On success: cache response and mark COMPLETED. On failure: mark FAILED so client can retry.
    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await this.idempotencyRepo.update(record.id, {
            status: IdempotencyStatus.COMPLETED,
            statusCode: res.statusCode || 200,
            responseBody: responseBody,
          });
        },
        error: async () => {
          await this.idempotencyRepo.update(record.id, {
            status: IdempotencyStatus.FAILED,
          });
        },
      }),
    );
  }
}
