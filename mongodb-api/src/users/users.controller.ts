import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: any) {
    return this.usersService.createUser(createUserDto);
  }

    @Get('test/index')
  async checkIndex() {
    return this.usersService.testIndex();
  }

    @Post(':userId/flash-sale')
  async flashSale(
    @Param('userId') userId: string,
    @Body('price') price: number,
  ) {
    return this.usersService.buyFlashSaleItem(userId, price);
  }

  @Post('seed-products')
  async seedProducts(@Body() products: { name: string; price: number }[]) {
    return this.usersService.seedProducts(products);
  }
  
    @Post(':userId/earn-points')
  async earnPoints(
    @Param('userId') userId: string,
    @Body('code') code: string,
  ) {
    return this.usersService.earnPoints(userId, code);
  }

  // POST /users/:userId/place-order
  @Post(':userId/place-order')
  async placeOrder(
    @Param('userId') userId: string,
    @Body('productId') productId: string,
  ) {
    return this.usersService.placeOrder(userId, productId);
  }

  // GET /users/:userId/dashboard
  @Get(':userId/dashboard')
  async getDashboard(@Param('userId') userId: string) {
    return this.usersService.getUserDashboard(userId);
  }

  @Get()
  async findAll() {
    return this.usersService.findAllUsers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOneUser(id);
  }
}