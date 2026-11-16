import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../modules/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', '127.0.0.1'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', '230904@sql11ALMONDS'),
        database: configService.get<string>('DB_DATABASE', 'redis'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: true, // auto creates schema in MySQL for development
        logging: ['error', 'warn'],
      }),
    }),
  ],
})
export class DatabaseModule {}
