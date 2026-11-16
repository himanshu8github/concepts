import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../modules/auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST') || process.env.DB_HOST || 'localhost',
        port: Number(configService.get<number>('DB_PORT') || process.env.DB_PORT || 3306),
        username: configService.get<string>('DB_USERNAME') || process.env.DB_USERNAME || 'root',
        password: String(configService.get<string>('DB_PASSWORD') ?? process.env.DB_PASSWORD ?? '2'),
        database: configService.get<string>('DB_DATABASE') || process.env.DB_DATABASE || 'redis',
        entities: [User],
        autoLoadEntities: true,
        synchronize: true, // Auto sync schema in development
        logging: ['error', 'warn'],
      }),
    }),
  ],
})
export class DatabaseModule {}
