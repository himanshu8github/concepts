import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  // Global request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 Redis & NestJS Application is running on port ${port}`);
  logger.log(`🛡️ Rate Limiting: Dual-Key (IP + Phone) Sliding Window Lua Active`);
  logger.log(`=======================================================`);
}

bootstrap();
