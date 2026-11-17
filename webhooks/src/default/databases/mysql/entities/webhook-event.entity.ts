import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookEventStatus {
  RECEIVED = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Entity({ name: 'webhook_events' })
export class WebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  // Unique event identifier sent by provider (e.g. evt_12345, or provider transaction ID)
  // Guarantees at-most-once processing (Idempotency)
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  eventId: string;

  // Name of provider: 'STRIPE', 'RAZORPAY', 'PHONEPE', 'GITHUB', etc.
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  // The event action/topic: 'payment.success', 'refund.created', 'order.shipped', etc.
  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  // The full raw payload received from the webhook
  @Column({ type: 'json' })
  payload: any;

  // Processing state
  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.RECEIVED,
  })
  status: WebhookEventStatus;

  // Error message if processing failed
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  receivedAt: Date;
}
