import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MongodbModule } from './default/databases/mongodb/mongodb.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Load .env
    MongodbModule, // <--- Your custom DB module
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}