import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Product } from '../../database/entities/product.entity';
import { User } from '../../database/entities/user.entity';
import { PlaceOrderDto } from './dto/create-order.dto';
import * as crypto from 'crypto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * RACE CONDITION PREVENTION with Pessimistic Locking:
   * When two concurrent requests try to buy the last stock of boAt Airdopes,
   * without a lock, both read stock=1 and both deduct -> stock becomes -1 (Overselling!).
   * With pessimistic_write (SELECT ... FOR UPDATE), the DB holds an exclusive lock on the product row.
   */
  async placeOrderWithLock(dto: PlaceOrderDto): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Verify user exists
      const user = await manager.findOne(User, { where: { id: dto.userId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${dto.userId} not found`);
      }

      // 2. Pessimistic Lock on product row to guarantee stock accuracy under high concurrency
      const product = await manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write') // Row level lock!
        .where('product.id = :id', { id: dto.productId })
        .getOne();

      if (!product) {
        throw new NotFoundException(`Product with ID ${dto.productId} not found`);
      }

      if (product.stock < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock! Only ${product.stock} units available for ${product.name}.`,
        );
      }

      // 3. Deduct stock safely
      product.stock -= dto.quantity;
      await manager.save(Product, product);

      // 4. Calculate total amount
      const totalAmount = Number(product.sellingPrice) * dto.quantity;

      // 5. Generate unique merchant transaction ID for PhonePe
      const merchantTransactionId = `MT_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // 6. Create order
      const order = manager.create(Order, {
        userId: dto.userId,
        productId: dto.productId,
        quantity: dto.quantity,
        amount: totalAmount,
        status: OrderStatus.PENDING,
        merchantTransactionId,
      });

      return await manager.save(Order, order);
    });
  }

  async getOrderById(id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'product'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async getOrderHistory(userId?: number): Promise<Order[]> {
    const query = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (userId) {
      query.where('order.userId = :userId', { userId });
    }

    return await query.getMany();
  }

  /**
   * Safe status update with Row Lock for Payment/Webhook processing
   */
  async updateOrderStatusWithLock(
    merchantTransactionId: string,
    newStatus: OrderStatus,
    providerRefId?: string,
  ): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.merchantTransactionId = :merchantTransactionId', {
          merchantTransactionId,
        })
        .getOne();

      if (!order) {
        throw new NotFoundException(
          `Order not found for transaction: ${merchantTransactionId}`,
        );
      }

      // Idempotent state transition: if already PAID, don't overwrite
      if (order.status === OrderStatus.PAID) {
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
