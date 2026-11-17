import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MongodbModule } from './default/databases/mongodb/mongodb.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Load .env
    MongodbModule, UsersModule, // <--- Your custom DB module
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}