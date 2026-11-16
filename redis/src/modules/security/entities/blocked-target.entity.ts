import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BlockType } from '../enums/block-type.enum';

@Entity('blocked_targets')
export class BlockedTarget {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index()
  @Column({ type: 'enum', enum: BlockType })
  type: BlockType;

  /** The IP address (e.g. 192.168.1.1) or Phone Number (e.g. +919876543210) */
  @Index()
  @Column({ type: 'varchar', length: 100 })
  target: string;

  @Column({ type: 'varchar', length: 255, default: 'Rate limit violation' })
  reason: string;

  /** 0 = Unblocked, 1 = Blocked */
  @Column({ type: 'tinyint', default: 1, comment: '0 = unblocked, 1 = blocked' })
  isBlocked: number;

  /** Null means permanent ban; Date means temporary cooldown ban */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
