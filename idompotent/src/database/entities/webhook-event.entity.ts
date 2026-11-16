import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'webhook_events' })
export class WebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  eventId: string; // Idempotency token for webhook: ensures duplicate webhook calls don't re-run

  @Column({ type: 'varchar', length: 100 })
  provider: string; // e.g., 'PHONEPE'

  @Column({ type: 'json' })
  payload: any;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @CreateDateColumn()
  receivedAt: Date;
}
