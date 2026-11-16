import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { SignupDto } from './dtos/signup.dto';
import { LoginDto } from './dtos/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Register a new user with email and hashed password
   */
  async signup(dto: SignupDto): Promise<{ message: string; user: Omit<User, 'password'> }> {
    const { email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password securely with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Persist new user
    const newUser = this.userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);
    this.logger.log(`[Signup] New user created with ID: ${savedUser.id} (${savedUser.email})`);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = savedUser;

    return {
      message: 'User registered successfully',
      user: userWithoutPassword,
    };
  }

  /**
   * Authenticate an existing user with email and password
   */
  async login(dto: LoginDto): Promise<{ message: string; user: Omit<User, 'password'>; token: string }> {
    const { email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    // Retrieve user including hidden password column
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`[Login Failed] Invalid password attempt for email: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`[Login Success] User ID: ${user.id} (${user.email}) logged in`);

    const { password: _, ...userWithoutPassword } = user;
    const token = `bearer-token-${user.id}-${Date.now()}`;

    return {
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    };
  }
}
