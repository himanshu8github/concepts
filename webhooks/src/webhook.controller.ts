import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Universal Webhook Ingestion Endpoint
   * e.g., POST /webhooks/stripe, POST /webhooks/phonepe, POST /webhooks/razorpay
   */
  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
  ) {
    return await this.webhookService.processWebhook(
      provider,
      payload,
      signature,
    );
  }

  /**
   * Helper endpoint to generate a valid test signature for Postman testing
   */
  @Post(':provider/generate-signature')
  generateSignature(@Body() payload: any) {
    const signature = this.webhookService.generateTestSignature(payload);
    return {
      message: 'Use this signature in the x-signature header when calling the webhook',
      signature,
      header: {
        'x-signature': signature,
      },
    };
  }

  /**
   * Audit / Log endpoint to see all received webhook events
   */
  @Get('events')
  async getEvents() {
    const events = await this.webhookService.getAllEvents();
    return {
      success: true,
      count: events.length,
      data: events,
    };
  }
}
