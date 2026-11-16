import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum IdempotencyStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity({ name: 'idempotency_keys' })
@Unique('uq_idem_user_endpoint_key', ['userId', 'endpoint', 'key'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Scoped to the authenticated user (e.g. from JWT req.user.id) to prevent cross-user key collisions
  @Column({ type: 'varchar', length: 100 })
  userId: string;

  // Endpoint path for scope isolation
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  // The client provided idempotent key (e.g., from header 'Idempotency-Key')
  @Column({ type: 'varchar', length: 128 })
  key: string;

  // Hash of the incoming request body to detect payload mismatches
  @Column({ type: 'varchar', length: 64 })
  requestPayloadHash: string;

  @Column({
    type: 'enum',
    enum: IdempotencyStatus,
    default: IdempotencyStatus.STARTED,
  })
  status: IdempotencyStatus;

  // Cached HTTP status code of the response
  @Column({ type: 'int', nullable: true })
  statusCode: number;

  // Cached response body (JSON)
  @Column({ type: 'json', nullable: true })
  responseBody: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
