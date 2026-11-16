# Complete E-Commerce Architecture Guide: Idempotency, Race Conditions, Rate Limiting & Webhooks

## 1. Concepts Deep Dive

### A. What is Idempotency & Why is it needed?
An HTTP request is **idempotent** if making the same request multiple times has the **exact same result** as making it once.
- `GET`, `PUT`, `DELETE` are inherently idempotent.
- `POST` is **non-idempotent**. If a customer clicks *"Place Order"* twice, or their mobile network hiccups and the app retries, 2 separate orders would be created and the customer would be charged twice without an idempotency mechanism.

#### How the Idempotency Key is Generated & Works:
1. **Client Generation**: The client creates a random unique UUID v4 (e.g. `uuidv4()` in JavaScript or `$randomUUID` in Postman):
   ```http
   Idempotency-Key: e41b714f-6d4b-4f91-88c9-0c671755a589
   ```
2. **Server Execution Flow (`idempotency.interceptor.ts`)**:
   - Takes `Idempotency-Key` + endpoint path + SHA-256 hash of the request body.
   - **First Call**: Saves row into `idempotency_keys` table with status `STARTED`. Executes the order creation. When complete, saves the HTTP status code (e.g. `201`) and response JSON, updating status to `COMPLETED`.
   - **Second Call (Exact duplicate retry)**: Detects key with `COMPLETED`. Directly replays the **cached response body** with header `X-Cache-Lookup: HIT - Replayed Idempotent Response`. **No duplicate order is saved, and no second charge happens!**
   - **Concurrent Call (Parallel spam)**: Returns `409 Conflict` (request currently in progress).
   - **Mismatched Payload**: If same key is reused for a different product/amount, it rejects with `400 Bad Request`.

---

### B. What is a Race Condition & How do we fix it?
A **race condition** happens when multiple concurrent processes read and modify shared state simultaneously, resulting in inconsistent data.

#### The Classic E-Commerce Problem:
Suppose product *Sony WH-1000XM4* has **`stock = 1`**.
- User A and User B click "Buy" at the exact same millisecond.
- Thread A checks: `stock >= 1` (True, stock is 1).
- Thread B checks: `stock >= 1` (True, stock is still 1).
- Thread A creates order and sets `stock = 0`.
- Thread B creates order and sets `stock = -1`.
- **Result**: Oversold item! You sold 2 units when you only had 1 in inventory.

#### Our Fix: Pessimistic Row Locking (`SELECT ... FOR UPDATE`)
In [order.service.ts](file:///c:/Users/surface/Desktop/concepts/idompotent/src/modules/order/order.service.ts):
```typescript
const product = await manager
  .getRepository(Product)
  .createQueryBuilder('product')
  .setLock('pessimistic_write') // Row level lock!
  .where('product.id = :id', { id: dto.productId })
  .getOne();
```
- When Thread A acquires `pessimistic_write`, MySQL locks that single product row.
- Thread B is forced to pause and wait until Thread A completes its transaction.
- When Thread B unlocks, it re-reads `stock = 0` and throws `400 Bad Request: Insufficient stock`.

---

### C. Rate Limiting
Protects endpoints from denial of service (DoS), bot scalping, and brute-force hammering.
- Configured using `@nestjs/throttler`:
  - **Global**: 60 requests per 60 seconds per IP.
  - **Checkout / Order creation**: Restricted to **5 requests per minute** per IP (`@Throttle({ default: { limit: 5, ttl: 60000 } })`).
- If exceeded, server immediately halts execution with `429 Too Many Requests`.

---

### D. Webhooks & Signatures (PhonePe Gateway)
A **webhook** is a reverse-API call where PhonePe notifies your backend when the customer finishes paying in UPI/Card.

#### Security & Consistency in Webhooks:
1. **Tampering / Spoofing Protection (Checksum Signature)**:
   - PhonePe sends an `X-VERIFY` header generated as:
     $$\text{SHA256}(\text{base64Payload} + \text{saltKey}) + \text{"\#\#\#"} + \text{saltIndex}$$
   - Your server computes the exact same hash using its secret `PHONEPE_SALT_KEY`. If someone attempts to forge a webhook, the signature fails with `401 Unauthorized`.
2. **Duplicate Webhook Delivery**:
   - PhonePe guarantees *at-least-once* delivery. If network is slow, PhonePe will send the same webhook 2 or 3 times.
   - We store an `eventId` in `webhook_events` with a `UNIQUE` index constraint. If the same webhook arrives again, it skips processing safely.

---

## 2. All API Endpoints & Testing Walkthrough

Base URL: `http://localhost:3000`

### 1. View Products (Auto-Seeded)
- **Method**: `GET`
- **URL**: `http://localhost:3000/products`
- **Response**:
  ```json
  {
    "success": true,
    "count": 4,
    "data": [
      {
        "id": 1,
        "name": "boAt Airdopes 141 Bluetooth Truly Wireless in Ear Earbuds",
        "sku": "BOAT-AIR-141",
        "mrp": "4490.00",
        "sellingPrice": "1299.00",
        "stock": 10
      },
      {
        "id": 2,
        "name": "Sony WH-1000XM4 Noise Cancelling Wireless Headphones",
        "sku": "SONY-WH-XM4",
        "mrp": "29990.00",
        "sellingPrice": "19990.00",
        "stock": 5
      },
      {
        "id": 3,
        "name": "boAt Wave Call Smartwatch with Bluetooth Calling",
        "sku": "BOAT-WAVE-CALL",
        "mrp": "7990.00",
        "sellingPrice": "1799.00",
        "stock": 15
      },
      {
        "id": 4,
        "name": "Noise ColorFit Pro 4 Advanced Bluetooth Calling Smart Watch",
        "sku": "NOISE-CFIT-PRO4",
        "mrp": "5999.00",
        "sellingPrice": "2499.00",
        "stock": 8
      }
    ]
  }
  ```

---

### 2. View Single Product Details
- **Method**: `GET`
- **URL**: `http://localhost:3000/products/1`

---

### 3. Place Order (Idempotent + Stock Deduct + Row Lock)
- **Method**: `POST`
- **URL**: `http://localhost:3000/orders`
- **Headers**:
  ```http
  Content-Type: application/json
  Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-112233445566
  ```
- **Body**:
  ```json
  {
    "userId": 1,
    "productId": 1,
    "quantity": 1
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Order placed successfully. Please proceed to payment.",
    "order": {
      "id": 1,
      "userId": 1,
      "productId": 1,
      "quantity": 1,
      "amount": 1299,
      "status": "PENDING",
      "merchantTransactionId": "MT_1763285000000_A1B2C3D4"
    }
  }
  ```
> **Idempotency Experiment**: Send this request again with the exact same `Idempotency-Key`. Notice you get the response back immediately with response header `X-Cache-Lookup: HIT - Replayed Idempotent Response`. Stock is NOT deducted twice and no new order ID is created.

---

### 4. Initiate PhonePe Payment Link
- **Method**: `POST`
- **URL**: `http://localhost:3000/payments/initiate`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "orderId": 1
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "PhonePe payment link generated successfully",
    "orderId": 1,
    "amount": "1299.00",
    "merchantTransactionId": "MT_1763285000000_A1B2C3D4",
    "paymentUrl": "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay?txn=MT_1763285000000_A1B2C3D4",
    "phonePeHeaders": {
      "Content-Type": "application/json",
      "X-VERIFY": "f78a05c7...###1"
    }
  }
  ```

---

### 5. Generate Mock Webhook Payload & Signature (Helper API)
Use this endpoint to generate a verified PhonePe base64 webhook response and its authentic `X-VERIFY` header for testing:
- **Method**: `POST`
- **URL**: `http://localhost:3000/payments/mock-generate-webhook`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "merchantTransactionId": "MT_1763285000000_A1B2C3D4",
    "status": "SUCCESS"
  }
  ```
- **Response**:
  ```json
  {
    "headers": {
      "Content-Type": "application/json",
      "X-VERIFY": "98a0b12e...###1"
    },
    "body": {
      "response": "eyJzdWNjZXNzIjp0cnVlLCJjb2RlIjoiUEFZTUVOVF9TVUNDRVNTIi..."
    }
  }
  ```

---

### 6. PhonePe Webhook Endpoint (Payment Confirmation)
- **Method**: `POST`
- **URL**: `http://localhost:3000/payments/webhook`
- **Headers**:
  ```http
  Content-Type: application/json
  X-VERIFY: <X-VERIFY value from Step 5>
  ```
- **Body**:
  ```json
  {
    "response": "<response base64 string from Step 5>"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Webhook executed. Order MT_1763285000000_A1B2C3D4 marked as PAID"
  }
  ```
> **Webhook Idempotency Experiment**: Send this webhook a second time in Postman. Notice the response:
> `"message": "Webhook duplicate delivery safely ignored (Idempotency check)."`

---

### 7. View Order History
- **Method**: `GET`
- **URL**: `http://localhost:3000/orders` (or filter by user: `http://localhost:3000/orders?userId=1`)
- Shows user information, product SKU, payment status (`PAID`), and transaction reference.

---

### 8. View Payment History
- **Method**: `GET`
- **URL**: `http://localhost:3000/payments/history`
- Displays all payments, transaction IDs, statuses (`SUCCESS`/`FAILED`), and gateway references.
