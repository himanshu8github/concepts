import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto, MockPhonePeWebhookDto } from './dto/payment.dto';
import { Throttle } from '@nestjs/throttler';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 1. Initiate Dummy PhonePe Payment Link
   * Idempotent: protected with Idempotency-Key header to prevent duplicate payment session creation
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Post('initiate')
  async initiatePayment(@Body() dto: InitiatePaymentDto) {
    return await this.paymentService.initiatePhonePePayment(dto.orderId);
  }

  /**
   * 2. Payment History API
   */
  @Get('history')
  async getPaymentHistory() {
    const history = await this.paymentService.getPaymentHistory();
    return {
      success: true,
      count: history.length,
      data: history,
    };
  }

  /**
   * 3. PhonePe Webhook Endpoint:
   * Handles payment confirmation securely with X-VERIFY signature verification and idempotency
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: MockPhonePeWebhookDto,
    @Headers('x-verify') xVerify: string,
  ) {
    if (!xVerify) {
      throw new BadRequestException('Missing X-VERIFY signature header');
    }

    return await this.paymentService.handlePhonePeWebhook(
      body.response,
      xVerify,
    );
  }

  /**
   * 4. Helper API for Postman testing:
   * Generates a realistic mock PhonePe webhook payload with the exact valid X-VERIFY checksum
   */
  @Post('mock-generate-webhook')
  mockGenerateWebhook(
    @Body()
    body: {
      merchantTransactionId: string;
      status?: 'SUCCESS' | 'PAYMENT_ERROR';
    },
  ) {
    const mockData = {
      responseCode: body.status || 'SUCCESS',
      code: body.status === 'PAYMENT_ERROR' ? 'PAYMENT_ERROR' : 'PAYMENT_SUCCESS',
      message: 'Payment completed successfully',
      data: {
        merchantId: 'PGTESTPAYUAT',
        merchantTransactionId: body.merchantTransactionId,
        transactionId: `T${Date.now()}`,
        amount: 129900,
        state: 'COMPLETED',
        responseCode: body.status || 'SUCCESS',
      },
    };

    const base64 = Buffer.from(JSON.stringify(mockData)).toString('base64');
    const xVerify = this.paymentService.generateChecksum(base64);

    return {
      guide: 'Copy this body and X-VERIFY header to test POST /payments/webhook in Postman',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
      body: {
        response: base64,
      },
      decodedPayload: mockData,
    };
  }
}
