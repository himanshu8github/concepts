import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto, MockPhonePeWebhookDto } from './dto/payment.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Endpoint to initiate payment with PhonePe
   */
  @Post('initiate')
  async initiatePayment(@Body() dto: InitiatePaymentDto) {
    return await this.paymentService.initiatePhonePePayment(dto.orderId);
  }

  /**
   * PhonePe Webhook Endpoint
   * Rate limited & Idempotent with signature verification
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
   * Helper endpoint to simulate a mock PhonePe callback payload and its correct X-VERIFY header
   * for testing in Postman/Curl
   */
  @Post('mock-generate-webhook-payload')
  mockGenerateWebhook(
    @Body()
    body: {
      merchantTransactionId: string;
      status: 'SUCCESS' | 'PAYMENT_ERROR';
    },
  ) {
    const mockData = {
      responseCode: body.status || 'SUCCESS',
      code: 'PAYMENT_SUCCESS',
      message: 'Payment completed successfully',
      data: {
        merchantId: 'PGTESTPAYUAT',
        merchantTransactionId: body.merchantTransactionId,
        transactionId: `PHONEPE_TXN_${Date.now()}`,
        amount: 50000,
        state: 'COMPLETED',
        responseCode: 'SUCCESS',
      },
    };

    const base64 = Buffer.from(JSON.stringify(mockData)).toString('base64');
    const xVerify = this.paymentService.generateChecksum(base64);

    return {
      instructions:
        'Copy "response" and "xVerifyHeader" to POST /payments/webhook to test the webhook idempotency',
      body: {
        response: base64,
      },
      xVerifyHeader: xVerify,
      decodedPayload: mockData,
    };
  }
}

