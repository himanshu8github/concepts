import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IdempotencyStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity({ name: 'idempotency_keys' })
@Index(['key', 'endpoint'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The client provided idempotent key (e.g., from header 'Idempotency-Key')
  @Column({ type: 'varchar', length: 120 })
  key: string;

  // Endpoint path for scope isolation
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  // Hash of the incoming request body to ensure exact match of request payloads
  @Column({ type: 'varchar', length: 64 })
  requestPayloadHash: string;

  // Cached HTTP status code of the response
  @Column({ type: 'int', nullable: true })
  statusCode: number;

  // Cached response body (JSON)
  @Column({ type: 'json', nullable: true })
  responseBody: any;

  @Column({
    type: 'enum',
    enum: IdempotencyStatus,
    default: IdempotencyStatus.STARTED,
  })
  status: IdempotencyStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

