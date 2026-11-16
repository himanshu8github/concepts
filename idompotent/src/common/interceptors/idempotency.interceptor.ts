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
} from '../database/entities/idempotency-key.entity';

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

    // 1. Extract Idempotency-Key from headers
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    // If no key is provided, proceed normally without idempotency caching
    if (!rawKey) {
      return next.handle();
    }

    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const endpoint = req.originalUrl || req.url;

    // 2. Hash request payload to detect mismatch (client reusing key with different payload)
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    // 3. Check if key exists
    let record = await this.idempotencyRepo.findOne({
      where: { key, endpoint },
    });

    if (record) {
      // Validate payload hash
      if (record.requestPayloadHash !== payloadHash) {
        throw new BadRequestException(
          'Idempotency-Key reuse detected with different payload parameters!',
        );
      }

      // If already COMPLETED: replay the exact cached response (Pure Idempotency)
      if (record.status === IdempotencyStatus.COMPLETED) {
        res.status(record.statusCode);
        res.setHeader('X-Cache-Lookup', 'HIT - Replayed Idempotent Response');
        return of(record.responseBody);
      }

      // If still STARTED: another concurrent request is already running
      if (record.status === IdempotencyStatus.STARTED) {
        throw new ConflictException(
          'A request with this Idempotency-Key is currently being processed. Please wait.',
        );
      }
    }

    // 4. Create initial record atomically with status STARTED
    try {
      record = this.idempotencyRepo.create({
        key,
        endpoint,
        requestPayloadHash: payloadHash,
        status: IdempotencyStatus.STARTED,
      });
      record = await this.idempotencyRepo.save(record);
    } catch (err) {
      // Handles race condition where two requests hit at exact same millisecond
      if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('duplicate')) {
        throw new ConflictException(
          'Concurrent request with the same Idempotency-Key detected!',
        );
      }
      throw err;
    }

    // 5. On successful response, save cached response & mark COMPLETED
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
          // If request failed, mark as FAILED so client can retry with same key
          await this.idempotencyRepo.update(record.id, {
            status: IdempotencyStatus.FAILED,
          });
        },
      }),
    );
  }
}

