import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { UserService } from '../user/user.service';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { SignupDto } from './dtos/signup.dto';
import { LoginDto } from './dtos/login.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly defaultOtp: string;
  private readonly otpTtlSeconds = 300; // 5 minutes
  private readonly cooldownSeconds = 60; // 60 seconds between resends

  constructor(
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    this.defaultOtp = this.configService.get<string>('DEFAULT_OTP', '880099');
  }

  /**
   * Sends OTP to a phone number and stores it in Redis with TTL.
   */
  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresInSeconds: number; defaultOtpHint: string }> {
    const { phoneNumber } = dto;
    const cooldownKey = `otp:cooldown:${phoneNumber}`;
    const otpKey = `otp:code:${phoneNumber}`;

    // Check cooldown (60 seconds)
    const isCoolingDown = await this.redisService.get(cooldownKey);
    if (isCoolingDown) {
      const ttl = await this.redisService.ttl(cooldownKey);
      throw new BadRequestException(
        `Please wait ${ttl} seconds before requesting another OTP`,
      );
    }

    const otp = this.defaultOtp; // Using requested default OTP 880099

    // Store OTP with 5-minute TTL
    await this.redisService.set(otpKey, otp, this.otpTtlSeconds);

    // Set cooldown with 60-second TTL
    await this.redisService.set(cooldownKey, '1', this.cooldownSeconds);

    this.logger.log(`[OTP Generated] Phone: ${phoneNumber} | Code: ${otp} (TTL: ${this.otpTtlSeconds}s)`);

    return {
      message: 'OTP sent successfully',
      expiresInSeconds: this.otpTtlSeconds,
      defaultOtpHint: this.defaultOtp,
    };
  }

  /**
   * Verifies OTP against Redis.
   */
  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const otpKey = `otp:code:${phoneNumber}`;
    const storedOtp = await this.redisService.get(otpKey);

    if (!storedOtp) {
      throw new BadRequestException('OTP has expired or was not requested');
    }

    if (storedOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP entered');
    }

    // Invalidate OTP after successful consumption to prevent replay attacks
    await this.redisService.del(otpKey);
    return true;
  }

  /**
   * Registers a new user with OTP verification.
   */
  async signup(dto: SignupDto): Promise<{ message: string; user: User }> {
    const { phoneNumber, otp, name, email } = dto;

    // Check if user already exists
    const existing = await this.userService.findByPhone(phoneNumber);
    if (existing) {
      throw new ConflictException('User with this phone number already exists. Please log in.');
    }

    // Verify and consume OTP
    await this.verifyOtp(phoneNumber, otp);

    // Create user in MySQL
    const user = await this.userService.createUser({
      phoneNumber,
      name,
      email,
    });

    this.logger.log(`User registered successfully: ${user.id} (${user.phoneNumber})`);

    return {
      message: 'Registration successful',
      user,
    };
  }

  /**
   * Logs in an existing user with OTP verification.
   */
  async login(dto: LoginDto): Promise<{ message: string; user: User; token: string }> {
    const { phoneNumber, otp } = dto;

    // Verify and consume OTP
    await this.verifyOtp(phoneNumber, otp);

    const user = await this.userService.findByPhone(phoneNumber);
    if (!user) {
      throw new BadRequestException('User does not exist. Please signup first.');
    }

    // Return mock session token (or JWT token)
    const token = `mock-jwt-token-for-${user.id}-${Date.now()}`;

    this.logger.log(`User logged in: ${user.id} (${user.phoneNumber})`);

    return {
      message: 'Login successful',
      user,
      token,
    };
  }
}
