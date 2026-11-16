import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { BlockedTarget } from '../entities/blocked-target.entity';
import { BlockType } from '../enums/block-type.enum';

@Injectable()
export class BlockedTargetRepository {
  constructor(
    @InjectRepository(BlockedTarget)
    private readonly repo: Repository<BlockedTarget>,
  ) {}

  /**
   * Checks if a target (IP or Phone) is currently blocked in the database (isBlocked = 1).
   */
  async findActiveBlock(target: string, type: BlockType): Promise<BlockedTarget | null> {
    const now = new Date();
    return this.repo.findOne({
      where: [
        // Permanent block: isBlocked = 1 AND expiresAt IS NULL
        { target, type, isBlocked: 1, expiresAt: IsNull() },
        // Temporary active block: isBlocked = 1 AND expiresAt > now
        { target, type, isBlocked: 1, expiresAt: MoreThan(now) },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async blockTarget(
    target: string,
    type: BlockType,
    reason: string,
    expiresAt?: Date | null,
  ): Promise<BlockedTarget> {
    const existing = await this.repo.findOne({ where: { target, type } });

    if (existing) {
      existing.isBlocked = 1;
      existing.reason = reason;
      existing.expiresAt = expiresAt || null;
      return this.repo.save(existing);
    }

    const created = this.repo.create({
      target,
      type,
      reason,
      isBlocked: 1,
      expiresAt: expiresAt || null,
    });
    return this.repo.save(created);
  }

  async unblockTarget(target: string, type: BlockType): Promise<boolean> {
    const result = await this.repo.update({ target, type }, { isBlocked: 0 });
    return (result.affected || 0) > 0;
  }

  async findAll(): Promise<BlockedTarget[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }
}
