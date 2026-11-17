import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../default/schema/user.schema.js';


@Injectable()
export class UsersService {
  // Inject the Mongoose Model
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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

  async findAllUsers(): Promise<User[]> {
    // .find() is equivalent to SQL SELECT * FROM users
    return this.userModel.find().exec();
  }

 async findOneUser(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    
    if (!user) {
      throw new NotFoundException('User not found'); // Fixed Error 2
    }
    
    return user;
  }
}