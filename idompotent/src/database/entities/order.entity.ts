import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // Merchant Transaction ID used to talk to PhonePe
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string;

  // PhonePe's transaction reference returned via gateway / webhook
  @Column({ type: 'varchar', length: 100, nullable: true })
  providerReferenceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

