import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { OrderModule } from '../order/order.module';
import { Payment } from '../../database/entities/payment.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, WebhookEvent]), OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
