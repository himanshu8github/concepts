import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1763285000000 implements MigrationInterface {
  name = 'InitialSchema1763285000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy or partially created tables if any exist
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`payments\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`orders\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`products\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`webhook_events\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`idempotency_keys\`;`);
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1;`);

    // 1. Create Users Table
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL,
        \`email\` varchar(150) NOT NULL UNIQUE,
        \`phone\` varchar(20) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;
    `);

    // 2. Create Products Table
    await queryRunner.query(`
      CREATE TABLE \`products\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(150) NOT NULL,
        \`sku\` varchar(60) NOT NULL UNIQUE,
        \`description\` text NULL,
        \`mrp\` decimal(10,2) NOT NULL,
        \`sellingPrice\` decimal(10,2) NOT NULL,
        \`stock\` int NOT NULL DEFAULT 100,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;
    `);

    // 3. Create Orders Table
    await queryRunner.query(`
      CREATE TABLE \`orders\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`userId\` int NOT NULL,
        \`productId\` int NOT NULL,
        \`quantity\` int NOT NULL DEFAULT 1,
        \`amount\` decimal(10,2) NOT NULL,
        \`status\` enum('PENDING','PAYMENT_INITIATED','PAID','FAILED') NOT NULL DEFAULT 'PENDING',
        \`merchantTransactionId\` varchar(120) NOT NULL UNIQUE,
        \`providerReferenceId\` varchar(120) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_orders_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`FK_orders_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB;
    `);

    // 4. Create Payments Table
    await queryRunner.query(`
      CREATE TABLE \`payments\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`orderId\` int NOT NULL,
        \`merchantTransactionId\` varchar(120) NOT NULL UNIQUE,
        \`phonepeTransactionId\` varchar(120) NULL,
        \`amount\` decimal(10,2) NOT NULL,
        \`status\` enum('INITIATED','SUCCESS','FAILED') NOT NULL DEFAULT 'INITIATED',
        \`paymentGateway\` varchar(50) NOT NULL DEFAULT 'PHONEPE',
        \`paymentUrl\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_payments_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB;
    `);

    // 5. Create Webhook Events Table
    await queryRunner.query(`
      CREATE TABLE \`webhook_events\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`eventId\` varchar(150) NOT NULL UNIQUE,
        \`provider\` varchar(100) NOT NULL,
        \`payload\` json NOT NULL,
        \`processed\` tinyint NOT NULL DEFAULT 0,
        \`receivedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;
    `);

    // 6. Create Idempotency Keys Table
    await queryRunner.query(`
      CREATE TABLE \`idempotency_keys\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`key\` varchar(150) NOT NULL,
        \`endpoint\` varchar(255) NOT NULL,
        \`requestPayloadHash\` varchar(64) NOT NULL,
        \`statusCode\` int NULL,
        \`responseBody\` json NULL,
        \`status\` enum('STARTED','COMPLETED','FAILED') NOT NULL DEFAULT 'STARTED',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_idempotency_key_endpoint\` (\`key\`, \`endpoint\`)
      ) ENGINE=InnoDB;
    `);

    // 7. Seed Initial Demo User & Products
    await queryRunner.query(`
      INSERT INTO \`users\` (\`name\`, \`email\`, \`phone\`) VALUES
      ('Rahul Sharma', 'rahul.sharma@example.com', '9876543210');
    `);

    await queryRunner.query(`
      INSERT INTO \`products\` (\`name\`, \`sku\`, \`description\`, \`mrp\`, \`sellingPrice\`, \`stock\`) VALUES
      ('boAt Airdopes 141 Bluetooth Truly Wireless in Ear Earbuds', 'BOAT-AIR-141', '42H Playtime, Beast Mode for Low Latency (80ms), ENx Tech, IPX4 Water Resistance.', 4490.00, 1299.00, 10),
      ('Sony WH-1000XM4 Noise Cancelling Wireless Headphones', 'SONY-WH-XM4', 'Industry leading active noise cancellation, 30 hours battery, touch sensor controls.', 29990.00, 19990.00, 5),
      ('boAt Wave Call Smartwatch with Bluetooth Calling', 'BOAT-WAVE-CALL', '1.69" HD Display with sharp screen, 150+ Watch Faces, Heart Rate & SpO2 Monitor.', 7990.00, 1799.00, 15),
      ('Noise ColorFit Pro 4 Advanced Bluetooth Calling Smart Watch', 'NOISE-CFIT-PRO4', '1.72" TFT LCD display, 60Hz refresh rate, 100 sports modes, digital crown.', 5999.00, 2499.00, 8);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`payments\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`orders\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`products\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`webhook_events\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`idempotency_keys\`;`);
  }
}

