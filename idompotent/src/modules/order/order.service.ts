import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import * as crypto from 'crypto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create an Order with a unique Merchant Transaction ID for PhonePe
   */
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const order = this.orderRepo.create({
      userId: dto.userId,
      amount: dto.amount,
      status: OrderStatus.PENDING,
      transactionId,
    });

    return await this.orderRepo.save(order);
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  /**
   * Safe status update demonstrating Pessimistic Locking to prevent Race Conditions.
   * If two parallel requests / webhooks try to update the order at the same time,
   * only ONE gets the row lock (`pessimistic_write` -> SELECT ... FOR UPDATE).
   */
  async updateOrderStatusWithLock(
    transactionId: string,
    newStatus: OrderStatus,
    providerRefId?: string,
  ): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      // PESSIMISTIC LOCK: Locks the row until this database transaction commits
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.transactionId = :transactionId', { transactionId })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Order not found for transaction: ${transactionId}`);
      }

      // Business logic check: Prevent duplicate status transition (Idempotent state check)
      if (order.status === OrderStatus.PAID) {
        // Already paid, ignore transition
        return order;
      }

      order.status = newStatus;
      if (providerRefId) {
        order.providerReferenceId = providerRefId;
      }

      return await manager.save(Order, order);
    });
  }
}

