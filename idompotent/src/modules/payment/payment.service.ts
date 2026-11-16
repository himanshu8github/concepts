import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OrderService } from '../order/order.service';
import { OrderStatus } from '../../database/entities/order.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';

@Injectable()
export class PaymentService {
  private readonly merchantId: string;
  private readonly saltKey: string;
  private readonly saltIndex: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    @InjectRepository(WebhookEvent)
    private readonly webhookRepo: Repository<WebhookEvent>,
  ) {
    this.merchantId =
      this.configService.get<string>('PHONEPE_MERCHANT_ID') || 'PGTESTPAYUAT';
    this.saltKey =
      this.configService.get<string>('PHONEPE_SALT_KEY') ||
      '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    this.saltIndex =
      this.configService.get<string>('PHONEPE_SALT_INDEX') || '1';
  }

  /**
   * Generates PhonePe standard X-VERIFY checksum:
   * SHA256(base64Payload + endpoint + saltKey) + "###" + saltIndex
   */
  generateChecksum(base64Payload: string, apiEndpoint: string = ''): string {
    const stringToHash = base64Payload + apiEndpoint + this.saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    return `${sha256}###${this.saltIndex}`;
  }

  /**
   * Initiates payment for an order and generates mock PhonePe payment payload & checksum
   */
  async initiatePhonePePayment(orderId: string) {
    const order = await this.orderService.getOrder(orderId);

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Order is already paid');
    }

    // PhonePe standard payload (amount is in paise)
    const paymentPayload = {
      merchantId: this.merchantId,
      merchantTransactionId: order.transactionId,
      merchantUserId: order.userId,
      amount: Math.round(Number(order.amount) * 100),
      redirectUrl: `http://localhost:3000/payments/callback?orderId=${order.id}`,
      redirectMode: 'POST',
      callbackUrl: 'http://localhost:3000/payments/webhook',
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    const xVerify = this.generateChecksum(base64Payload, '/pg/v1/pay');

    await this.orderService.updateOrderStatusWithLock(
      order.transactionId,
      OrderStatus.PAYMENT_INITIATED,
    );

    return {
      message: 'Payment initiated with PhonePe gateway',
      orderId: order.id,
      merchantTransactionId: order.transactionId,
      payload: paymentPayload,
      base64Payload,
      xVerify,
      mockPaymentGatewayUrl: `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay`,
    };
  }

  /**
   * Webhook Processor with 3-Layer Defense:
   * 1. Checksum verification (Prevents spoofing)
   * 2. Idempotent Event Deduplication in DB (Prevents duplicate processing of repeated webhook deliveries)
   * 3. Pessimistic Lock during state update (Prevents race conditions)
   */
  async handlePhonePeWebhook(base64Response: string, xVerifyHeader: string) {
    // 1. Verify Checksum
    const expectedChecksum = this.generateChecksum(base64Response);
    if (xVerifyHeader !== expectedChecksum) {
      throw new UnauthorizedException('Invalid X-VERIFY signature from webhook!');
    }

    // 2. Decode Payload
    const decodedString = Buffer.from(base64Response, 'base64').toString('utf-8');
    const webhookData = JSON.parse(decodedString);

    const {
      responseCode,
      data: {
        merchantTransactionId,
        transactionId: providerReferenceId,
      },
    } = webhookData;

    // Use PhonePe's transaction reference as unique webhook event ID for idempotency
    const eventId = `PHONEPE_${providerReferenceId || merchantTransactionId}`;

    // 3. Webhook Idempotency Check: Save event atomically
    const existingEvent = await this.webhookRepo.findOne({ where: { eventId } });
    if (existingEvent && existingEvent.processed) {
      return {
        success: true,
        message: 'Webhook event already processed (Idempotency check passed).',
      };
    }

    if (!existingEvent) {
      try {
        await this.webhookRepo.save({
          eventId,
          provider: 'PHONEPE',
          payload: webhookData,
          processed: false,
        });
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('duplicate')) {
          return {
            success: true,
            message: 'Webhook duplicate event detected concurrently.',
          };
        }
        throw err;
      }
    }

    // 4. Update order status safely using Pessimistic Database Lock (Race condition protection)
    const finalStatus =
      responseCode === 'SUCCESS' ? OrderStatus.PAID : OrderStatus.FAILED;

    await this.orderService.updateOrderStatusWithLock(
      merchantTransactionId,
      finalStatus,
      providerReferenceId,
    );

    // Mark event processed
    await this.webhookRepo.update({ eventId }, { processed: true });

    return {
      success: true,
      message: `Webhook processed. Order ${merchantTransactionId} marked as ${finalStatus}`,
    };
  }
}

