import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dtos/send-otp.dto';
import { SignupDto } from './dtos/signup.dto';
import { LoginDto } from './dtos/login.dto';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RedisRateLimitGuard } from '../../common/guards/redis-rate-limit.guard';

@Controller('auth')
@UseGuards(RedisRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Send OTP endpoint:
   * Dual-Key protection:
   * - Phone limit: Max 3 OTP requests / min per phone
   * - IP limit: Max 10 requests / min per IP (stops attacker cycling random phones from 1 IP!)
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    phoneLimit: 3,
    ipLimit: 10,
    windowSeconds: 60,
    prefix: 'auth:send-otp',
    autoBlockThresholdMultiplier: 3,
    blockDurationMinutes: 60,
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  /**
   * Signup endpoint:
   * Rate limited: Max 5 signups per 60 seconds per IP
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({
    ipLimit: 5,
    phoneLimit: 3,
    windowSeconds: 60,
    prefix: 'auth:signup',
  })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /**
   * Login endpoint:
   * Dual-Key protection:
   * - Phone limit: Max 5 attempts per phone number (stops brute forcing Alice's account across proxy IPs)
   * - IP limit: Max 15 attempts per IP (stops attacker testing multiple accounts from 1 IP)
   * - Auto-Block: If someone tries 15 times (>3x limit), both IP and Phone are written to MySQL blocklist!
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    phoneLimit: 5,
    ipLimit: 15,
    windowSeconds: 60,
    prefix: 'auth:login',
    autoBlockThresholdMultiplier: 3,
    blockDurationMinutes: 60,
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
