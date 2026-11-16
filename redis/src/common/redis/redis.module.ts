import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisClient');
        const host = configService.get<string>('REDIS_HOST', '127.0.0.1');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD', '');

        const client = new Redis({
          host,
          port,
          password: password ? password : undefined,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
        });

        client.on('connect', () => {
          logger.log(`Connected to Redis server at ${host}:${port}`);
        });

        client.on('error', (err) => {
          logger.error(`Redis connection error: ${err.message}`, err.stack);
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
