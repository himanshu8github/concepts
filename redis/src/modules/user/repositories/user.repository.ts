import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByPhone(phoneNumber: string): Promise<User | null> {
    return this.repo.findOne({ where: { phoneNumber } });
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.repo.create(userData);
    return this.repo.save(user);
  }

  async update(id: number, updateData: Partial<User>): Promise<User> {
    await this.repo.update(id, updateData);
    return this.findById(id);
  }
}
