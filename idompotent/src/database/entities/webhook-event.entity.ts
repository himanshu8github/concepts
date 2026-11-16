import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'webhook_events' })
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Unique event ID from payment gateway or webhook payload
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  eventId: string;

  @Column({ type: 'varchar', length: 100 })
  provider: string; // e.g., 'PHONEPE'

  @Column({ type: 'json' })
  payload: any;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @CreateDateColumn()
  receivedAt: Date;
}

