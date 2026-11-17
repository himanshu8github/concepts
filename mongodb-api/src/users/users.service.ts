import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { User, UserDocument } from '../default/schema/user.schema.js';
import { PointHistory, PointHistoryDocument } from '../default/schema/point-history.schema.js';
import { Order, OrderDocument } from '../default/schema/order.schema.js';
import { Product, ProductDocument } from '../default/schema/product.schema.js';

@Injectable()
export class UsersService {
  // Inject the Mongoose Model
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PointHistory.name) private pointHistoryModel: Model<PointHistoryDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
       @InjectConnection() private connection: Connection, 
  ) {}

  async createUser(data: any): Promise<User> {
    try {
      // .create() is equivalent to SQL INSERT INTO
      const newUser = new this.userModel(data);
      return await newUser.save();
    } catch (error: any) {
      // Error code 11000 means a unique constraint failed (e.g., duplicate email)
      if (error.code === 11000) {
        throw new ConflictException('Email already exists!');
      }
      throw error;
    }
  }


async buyFlashSaleItem(userId: string, productPrice: number) {
  if (!Number.isFinite(productPrice) || productPrice <= 0) {
    throw new BadRequestException('Invalid product price');
  }

  const session = await this.connection.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Atomic wallet deduction
      const updatedUser = await this.userModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(userId),
          walletPoints: { $gte: productPrice },
        },
        {
          $inc: {
            walletPoints: -productPrice,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!updatedUser) {
        throw new BadRequestException(
          'Insufficient points or User not found',
        );
      }

      // Create order
      const orderNumber = `ORD-FLASH-${Date.now()}`;

      const [order] = await this.orderModel.create(
        [
          {
            userId: updatedUser._id,
            orderNumber,
            productId: 'FLASH-SALE-ITEM',
            pointsCost: productPrice,
          },
        ],
        { session },
      );

      result = {
        message: 'Success!',
        newBalance: updatedUser.walletPoints,
        orderNumber: order.orderNumber,
      };
    });

    return result;

  } finally {
    await session.endSession();
  }
}


    async seedProducts(productsData: { name: string; price: number }[]) {
    if (!productsData || productsData.length === 0) {
      throw new BadRequestException('Please provide an array of products in the body');
    }

    // insertMany takes an array of objects and saves them all at once
    const result = await this.productModel.insertMany(productsData);
    
    return { 
      message: 'Products seeded successfully', 
      count: result.length,
      insertedProducts: result 
    };
  }

  async findAllUsers(): Promise<User[]> {
    // .find() is equivalent to SQL SELECT * FROM users
    return this.userModel.find().exec();
  }


    // Add this temporary method to test indexing
  async testIndex() {
    // Run explain on a query searching for an email
    return this.userModel.find({ email: 'himanshu@example.com' }).explain('executionStats');
  }
  
 async findOneUser(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    
    if (!user) {
      throw new NotFoundException('User not found'); // Fixed Error 2
    }
    
    return user;
  }

    async earnPoints(userId: string, code: string) {
    // In a real app, you would validate the 6-digit 'code' here
    if (code.length !== 6 || isNaN(Number(code))) {
      throw new BadRequestException('Invalid 6-digit code');
    }

    const pointsToEarn = 50;

    // Increase user wallet
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { walletPoints: pointsToEarn } }, // $inc is a MongoDB atomic operator (like +=)
      { new: true } // Return the updated document
    );

    if (!user) throw new NotFoundException('User not found');

    // Create point history
    await this.pointHistoryModel.create({
      userId: new Types.ObjectId(userId),
      points: pointsToEarn,
      status: 1, // 1 = Earn
      description: `Earned via code: ${code}`
    });

    return { message: 'Points credited successfully', currentBalance: user.walletPoints };
  }

  // 2. PLACE ORDER API
async placeOrder(userId: string, productId: string) {
    // 1. Validate if the productId is a valid MongoDB ObjectId format
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid Product ID format');
    }

    // 2. Find the product in the database
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found in database');
    }

    // 3. Find the user
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 4. Check if the user has enough points
    if (user.walletPoints < product.price) {
      throw new BadRequestException(
        `Insufficient points. You need ${product.price} points, but you only have ${user.walletPoints}.`
      );
    }

    // 5. Deduct the points from the user's wallet
    user.walletPoints -= product.price;
    await user.save();

    // 6. Generate a unique Order Number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 7. Create the Order document
    const order = await this.orderModel.create({
      userId: user._id,
      orderNumber,
      productId: product._id.toString(),
      pointsCost: product.price,
    });

    // 8. Create the Point History (Redeem status = 2)
    await this.pointHistoryModel.create({
      userId: user._id,
      points: product.price,
      status: 2, 
      description: `Redeemed for ${product.name} (Order: ${orderNumber})`,
    });

    // 9. Return the success response
    return { 
      message: 'Order placed successfully', 
      orderDetails: order, 
      remainingPoints: user.walletPoints 
    };
  }

  // 3. GET USER DASHBOARD (User + History + Orders)
  async getUserDashboard(userId: string) {
    const user = await this.userModel.findById(userId).select('-password'); // Exclude password
    if (!user) throw new NotFoundException('User not found');

    // Fetch history and orders in parallel for speed
    const [pointHistory, orders] = await Promise.all([
      this.pointHistoryModel.find({ userId: user._id }).sort({ createdAt: -1 }),
      this.orderModel.find({ userId: user._id }).sort({ createdAt: -1 }),
    ]);

    return {
      userDetails: user,
      pointHistory,
      orderHistory: orders,
    };
  }
}