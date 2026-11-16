import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OrderService } from '../order/order.service';
import { OrderStatus } from '../../database/entities/order.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';

@Injectable()
export class PaymentService {
  private readonly merchantId: string;
  private readonly saltKey: string;
  private readonly saltIndex: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
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
   * PhonePe Signature Checksum Algorithm:
   * SHA256(base64Payload + endpoint + saltKey) + "###" + saltIndex
   */
  generateChecksum(base64Payload: string, apiEndpoint: string = ''): string {
    const stringToHash = base64Payload + apiEndpoint + this.saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    return `${sha256}###${this.saltIndex}`;
  }

  /**
   * Initiates payment for an order and generates mock PhonePe redirect URL & checksum
   */
  async initiatePhonePePayment(orderId: number) {
    const order = await this.orderService.getOrderById(orderId);

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('This order is already paid!');
    }

    // PhonePe payload specification (amount is sent in paise -> rupees * 100)
    const paymentPayload = {
      merchantId: this.merchantId,
      merchantTransactionId: order.merchantTransactionId,
      merchantUserId: `USER_${order.userId}`,
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

    // PhonePe checkout redirect URL (Standard Sandbox)
    const dummyPhonePeGatewayUrl = `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay?txn=${order.merchantTransactionId}`;

    // Record or update payment entry
    let payment = await this.paymentRepo.findOne({
      where: { merchantTransactionId: order.merchantTransactionId },
    });

    if (!payment) {
      payment = this.paymentRepo.create({
        orderId: order.id,
        merchantTransactionId: order.merchantTransactionId,
        amount: order.amount,
        status: PaymentStatus.INITIATED,
        paymentGateway: 'PHONEPE',
        paymentUrl: dummyPhonePeGatewayUrl,
      });
      await this.paymentRepo.save(payment);
    }

    await this.orderService.updateOrderStatusWithLock(
      order.merchantTransactionId,
      OrderStatus.PAYMENT_INITIATED,
    );

    return {
      success: true,
      message: 'PhonePe payment link generated successfully',
      orderId: order.id,
      amount: order.amount,
      merchantTransactionId: order.merchantTransactionId,
      paymentUrl: dummyPhonePeGatewayUrl,
      phonePeHeaders: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
      phonePeRequestBody: {
        request: base64Payload,
      },
      rawDecodedPayload: paymentPayload,
    };
  }

  /**
   * PhonePe Webhook Processing with 3-Way Protection:
   * 1. Signature Check (X-VERIFY validation)
   * 2. Idempotency Token (webhook_events table unique eventId deduplication)
   * 3. Row Lock (Pessimistic write prevents concurrent race condition)
   */
  async handlePhonePeWebhook(base64Response: string, xVerifyHeader: string) {
    // 1. Signature Verification
    const expectedChecksum = this.generateChecksum(base64Response);
    if (xVerifyHeader !== expectedChecksum) {
      throw new UnauthorizedException('Invalid X-VERIFY signature! Request rejected.');
    }

    // 2. Decode payload
    const decodedString = Buffer.from(base64Response, 'base64').toString('utf-8');
    const webhookData = JSON.parse(decodedString);

    const {
      responseCode,
      data: {
        merchantTransactionId,
        transactionId: providerReferenceId,
      },
    } = webhookData;

    // Unique eventId used as Webhook Idempotency Token
    const eventId = `PHONEPE_HOOK_${providerReferenceId || merchantTransactionId}`;

    // 3. Webhook Idempotency: Check if this event was already processed
    const existingEvent = await this.webhookRepo.findOne({ where: { eventId } });
    if (existingEvent && existingEvent.processed) {
      return {
        success: true,
        message: 'Webhook duplicate delivery safely ignored (Idempotency check).',
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

    // 4. Update order and payment safely with lock
    const isSuccess = responseCode === 'SUCCESS';
    const finalOrderStatus = isSuccess ? OrderStatus.PAID : OrderStatus.FAILED;
    const finalPaymentStatus = isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    await this.orderService.updateOrderStatusWithLock(
      merchantTransactionId,
      finalOrderStatus,
      providerReferenceId,
    );

    await this.paymentRepo.update(
      { merchantTransactionId },
      {
        status: finalPaymentStatus,
        phonepeTransactionId: providerReferenceId,
      },
    );

    // Mark event processed
    await this.webhookRepo.update({ eventId }, { processed: true });

    return {
      success: true,
      message: `Webhook executed. Order ${merchantTransactionId} marked as ${finalOrderStatus}`,
    };
  }

  async getPaymentHistory(): Promise<Payment[]> {
    return await this.paymentRepo.find({
      relations: ['order'],
      orderBy: { createdAt: 'DESC' },
    });
  }
}
