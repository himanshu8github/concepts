import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { OrderModule } from '../order/order.module';
import { Payment } from '../../database/entities/payment.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';
import { IdempotencyKey } from '../../database/entities/idempotency-key.entity';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, WebhookEvent, IdempotencyKey]),
    OrderModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, IdempotencyInterceptor],
})
export class PaymentModule {}
