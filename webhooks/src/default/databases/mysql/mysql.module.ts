import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import mysqlConfig from './mysql.config';
import { WebhookEvent } from './entities/webhook-event.entity';

@Module({
  imports: [
    ConfigModule.forFeature(mysqlConfig),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('mysql.host'),
        port: configService.get<number>('mysql.port'),
        username: configService.get<string>('mysql.username'),
        password: configService.get<string>('mysql.password'),
        database: configService.get<string>('mysql.database'),
        entities: [WebhookEvent],
        synchronize: true, // Auto-creates webhook_events table in development
        logging: ['error', 'warn'],
      }),
    }),
    TypeOrmModule.forFeature([WebhookEvent]),
  ],
  exports: [TypeOrmModule],
})
export class MysqlModule {}
