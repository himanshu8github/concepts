import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { PlaceOrderDto } from './dto/create-order.dto';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { Throttle } from '@nestjs/throttler';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Place Order API:
   * 1. Rate Limiting: Max 5 orders per 60 seconds per IP (protects checkout endpoint)
   * 2. Idempotency: Uses 'Idempotency-Key' header so duplicate clicks don't create multiple orders
   * 3. Race Condition: Uses pessimistic row locking to prevent stock overselling
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  async placeOrder(@Body() dto: PlaceOrderDto) {
    const order = await this.orderService.placeOrderWithLock(dto);
    return {
      success: true,
      message: 'Order placed successfully. Please proceed to payment.',
      order,
    };
  }

  /**
   * Order History API: View all orders or filter by ?userId=1
   */
  @Get()
  async getOrderHistory(@Query('userId') userId?: string) {
    const parsedUserId = userId ? parseInt(userId, 10) : undefined;
    const orders = await this.orderService.getOrderHistory(parsedUserId);
    return {
      success: true,
      count: orders.length,
      data: orders,
    };
  }

  @Get(':id')
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.getOrderById(id);
    return {
      success: true,
      data: order,
    };
  }
}
