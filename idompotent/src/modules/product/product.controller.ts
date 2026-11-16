import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProductService } from './product.service';
import { Throttle } from '@nestjs/throttler';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Rate Limiting: 30 requests per minute
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get()
  async getProducts() {
    const products = await this.productService.getAllProducts();
    return {
      success: true,
      count: products.length,
      data: products,
    };
  }

  @Get(':id')
  async getProductById(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productService.getProductById(id);
    return {
      success: true,
      data: product,
    };
  }
}

