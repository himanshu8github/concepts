import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedTarget } from './entities/blocked-target.entity';
import { BlockedTargetRepository } from './repositories/blocked-target.repository';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([BlockedTarget])],
  controllers: [SecurityController],
  providers: [BlockedTargetRepository, SecurityService],
  exports: [SecurityService, BlockedTargetRepository],
})
export class SecurityModule {}
