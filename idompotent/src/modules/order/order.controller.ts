import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { Throttle } from '@nestjs/throttler';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Order creation endpoint:
   * 1. Rate-Limited: Max 5 requests per 60 seconds per IP
   * 2. Idempotent: Accepts header 'Idempotency-Key' to avoid duplicate orders
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    const order = await this.orderService.createOrder(dto);
    return {
      message: 'Order created successfully',
      order,
    };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return await this.orderService.getOrder(id);
  }
}

