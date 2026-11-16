import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './database/entities/user.entity';
import { Product } from './database/entities/product.entity';
import { Order } from './database/entities/order.entity';
import { Payment } from './database/entities/payment.entity';
import { WebhookEvent } from './database/entities/webhook-event.entity';
import { IdempotencyKey } from './database/entities/idempotency-key.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'idom',
  entities: [User, Product, Order, Payment, WebhookEvent, IdempotencyKey],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // Turned off - use migrations!
  logging: true,
});

