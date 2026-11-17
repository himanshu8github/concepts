# Webhooks Learning Architecture Guide

This minimal NestJS setup teaches the core fundamentals of webhooks with MySQL:
1. **At-Least-Once Delivery & Idempotency** (Prevent duplicate processing).
2. **Signature Verification / HMAC-SHA256** (Prevent spoofing & fake webhook calls).
3. **Audit Logging & Event Status** (`RECEIVED`, `PROCESSED`, `FAILED`).

---

## Folder Structure

```text
webhooks/
├── src/
│   ├── default/
│   │   └── databases/
│   │       └── mysql/
│   │           ├── entities/
│   │           │   └── webhook-event.entity.ts
│   │           ├── mysql.config.ts
│   │           └── mysql.module.ts
│   ├── app.module.ts
│   ├── main.ts
│   ├── webhook.controller.ts
│   └── webhook.service.ts
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 1. Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Create `.env` using `.env.example`:
```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=your_database_name

WEBHOOK_SECRET=my_super_secret_webhook_key_12345
```

### Step 3: Start Application
```bash
npm run start:dev
```

---

## 2. API Endpoints & Testing Walkthrough

### Test A: Send a Webhook (With Unique Event ID)
* **Method**: `POST`
* **URL**: `http://localhost:3001/webhooks/stripe`
* **Headers**:
  ```http
  Content-Type: application/json
  ```
* **Body**:
  ```json
  {
    "id": "evt_order_1001",
    "type": "payment.success",
    "orderId": 55,
    "amount": 2500,
    "currency": "INR"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "message": "Webhook received and processed successfully",
    "eventId": "evt_order_1001"
  }
  ```

---

### Test B: Test Webhook Idempotency (Retry Delivery)
Webhook providers (Stripe, Razorpay, PhonePe) retry sending webhooks if network latency occurs.
Hit **Send** again with the exact same payload:
* **Response**:
  ```json
  {
    "success": true,
    "message": "Duplicate webhook event received and ignored (Idempotent)",
    "eventId": "evt_order_1001",
    "status": "PROCESSED"
  }
  ```
*Notice: The order logic does not run twice, protecting against double fulfillment.*

---

### Test C: Signature Verification (HMAC-SHA256)
To ensure the webhook actually came from your payment provider and not an attacker:
1. Generate signature:
   * **POST** `http://localhost:3001/webhooks/stripe/generate-signature` with your body payload.
2. Call **POST** `http://localhost:3001/webhooks/stripe` with header:
   ```http
   x-signature: <generated_signature>
   ```
   *If an attacker tampers with the payload, the server will reject it with `401 Unauthorized: Invalid Webhook Signature`.*

---

### Test D: View Webhook Event Log in Database
* **Method**: `GET`
* **URL**: `http://localhost:3001/webhooks/events`
* Lists all webhook events stored in MySQL with their processing timestamps and statuses.
