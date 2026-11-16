import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findByPhone(phoneNumber: string): Promise<User | null> {
    return this.userRepository.findByPhone(phoneNumber);
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async createUser(data: { phoneNumber: string; name?: string; email?: string }): Promise<User> {
    const existing = await this.userRepository.findByPhone(data.phoneNumber);
    if (existing) {
      throw new ConflictException(`User with phone ${data.phoneNumber} already exists`);
    }
    return this.userRepository.create(data);
  }
}
