import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  WebhookEvent,
  WebhookEventStatus,
} from './default/databases/mysql/entities/webhook-event.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookRepo: Repository<WebhookEvent>,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('WEBHOOK_SECRET') ||
      'my_super_secret_webhook_key_12345';
  }

  /**
   * 1. Signature Verification (HMAC-SHA256)
   * Prevents spoofing / fake webhooks from attackers
   */
  verifySignature(payload: any, signatureHeader: string): boolean {
    if (!signatureHeader) return false;

    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Helper to generate a valid signature for testing
   */
  generateTestSignature(payload: any): string {
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * 2. Webhook Event Ingestion (Idempotent)
   * Handles at-least-once delivery from webhook providers
   */
  async processWebhook(
    provider: string,
    payload: any,
    signatureHeader?: string,
  ) {
    // A. Verify Signature if header provided
    if (signatureHeader && !this.verifySignature(payload, signatureHeader)) {
      this.logger.warn(`Invalid signature attempt for provider: ${provider}`);
      throw new UnauthorizedException('Invalid Webhook Signature');
    }

    // B. Extract Event ID
    const eventId =
      payload.id || payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const eventType = payload.type || payload.event || 'generic.event';

    // C. Check Idempotency: Has this event already been processed?
    const existing = await this.webhookRepo.findOne({ where: { eventId } });
    if (existing) {
      this.logger.log(`Duplicate webhook event ignored: ${eventId}`);
      return {
        success: true,
        message: 'Duplicate webhook event received and ignored (Idempotent)',
        eventId,
        status: existing.status,
      };
    }

    // D. Store the incoming webhook event
    const event = this.webhookRepo.create({
      eventId,
      provider: provider.toUpperCase(),
      eventType,
      payload,
      status: WebhookEventStatus.RECEIVED,
    });

    try {
      await this.webhookRepo.save(event);

      // E. Execute Business Logic based on eventType
      await this.handleBusinessLogic(eventType, payload);

      // F. Mark as PROCESSED
      event.status = WebhookEventStatus.PROCESSED;
      await this.webhookRepo.save(event);

      this.logger.log(`Webhook event ${eventId} processed successfully`);
      return {
        success: true,
        message: 'Webhook received and processed successfully',
        eventId,
      };
    } catch (err: any) {
      event.status = WebhookEventStatus.FAILED;
      event.errorMessage = err.message;
      await this.webhookRepo.save(event);
      throw err;
    }
  }

  private async handleBusinessLogic(eventType: string, payload: any) {
    switch (eventType) {
      case 'payment.success':
        this.logger.log(`Payment confirmed for order: ${payload.orderId || payload.id}`);
        break;
      case 'payment.failed':
        this.logger.warn(`Payment failed for order: ${payload.orderId || payload.id}`);
        break;
      case 'refund.created':
        this.logger.log(`Refund initiated: ${payload.refundId}`);
        break;
      default:
        this.logger.log(`Handled event: ${eventType}`);
    }
  }

  async getAllEvents() {
    return await this.webhookRepo.find({
      order: { receivedAt: 'DESC' },
    });
  }
}
