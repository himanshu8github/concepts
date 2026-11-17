import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MysqlModule } from './default/databases/mysql/mysql.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    // Global Config (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Custom MySQL Database Module
    MysqlModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class AppModule {}
