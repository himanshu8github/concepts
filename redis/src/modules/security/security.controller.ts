import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SecurityService } from './security.service';
import { BlockType } from './enums/block-type.enum';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  /**
   * View all blocked IPs and Phones from MySQL database
   */
  @Get('blocked')
  async getAllBlocked() {
    return this.securityService.getAllBlocked();
  }

  /**
   * Manually block an IP or Phone
   */
  @Post('block')
  @HttpCode(HttpStatus.OK)
  async blockTarget(
    @Body()
    body: {
      target: string;
      type: BlockType;
      reason?: string;
      durationMinutes?: number;
    },
  ) {
    return this.securityService.blockTarget(
      body.target,
      body.type,
      body.reason || 'Manually blocked by administrator',
      body.durationMinutes,
    );
  }

  /**
   * Manually unblock an IP or Phone
   */
  @Post('unblock')
  @HttpCode(HttpStatus.OK)
  async unblockTarget(
    @Body()
    body: {
      target: string;
      type: BlockType;
    },
  ) {
    const success = await this.securityService.unblockTarget(body.target, body.type);
    return {
      success,
      message: `${body.type} ${body.target} has been unblocked`,
    };
  }
}
