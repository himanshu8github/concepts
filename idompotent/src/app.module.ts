import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { User } from './database/entities/user.entity';
import { Product } from './database/entities/product.entity';
import { Order } from './database/entities/order.entity';
import { Payment } from './database/entities/payment.entity';
import { WebhookEvent } from './database/entities/webhook-event.entity';
import { IdempotencyKey } from './database/entities/idempotency-key.entity';

import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';

@Module({
  imports: [
    // Global environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Global Rate Limiting Throttler (Default: 60 requests per 60 seconds per IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // MySQL TypeORM Connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<number>('DB_PORT', 3306)),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'idom'),
        entities: [
          User,
          Product,
          Order,
          Payment,
          WebhookEvent,
          IdempotencyKey,
        ],
        synchronize: false, // Migrations manage database schema changes
        logging: ['error', 'warn'],
      }),
    }),

    ProductModule,
    OrderModule,
    PaymentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
