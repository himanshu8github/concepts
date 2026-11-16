import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { IdempotencyKey } from '../../database/entities/idempotency-key.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Order, IdempotencyKey])],
  controllers: [OrderController],
  providers: [OrderService, IdempotencyInterceptor],
  exports: [OrderService],
})
export class OrderModule {}

