import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { User, UserSchema } from '../default/schema/user.schema.js';
import { PointHistory, PointHistorySchema } from '../default/schema/point-history.schema.js';
import { Order, OrderSchema } from '../default/schema/order.schema.js';
import { Product, ProductSchema } from '../default/schema/product.schema.js';


@Module({
  imports: [
    // This registers the schema with the MongoDB connection
 MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PointHistory.name, schema: PointHistorySchema },
      { name: Order.name, schema: OrderSchema },
        { name: Product.name, schema: ProductSchema }, 
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}