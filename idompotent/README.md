# Core Concepts Guide: Idempotency, Rate Limiting, Race Conditions & Webhooks

## 1. What is Idempotency & Why is it needed?
An operation is **idempotent** if applying it multiple times produces the **exact same result** without unintended side effects.

- **HTTP GET / PUT / DELETE**: Naturally idempotent. (Requesting or deleting an entity multiple times leaves the system in the same final state).
- **HTTP POST**: **NOT** idempotent by default. If a user clicks *"Pay Now"* or *"Place Order"* twice, or if a network timeout causes the client to retry, the server could create duplicate orders or deduct money twice!

### How Idempotency Keys Work
1. The client generates a unique UUID (e.g. `Idempotency-Key: e41b714f-6d4b-4f91-88c9-0c671755a589`) and passes it in the HTTP request headers.
2. The server receives the request and checks the database:
   - **First Request**: Key does not exist. An entry is saved with status `STARTED`. The order is created and saved. Status is updated to `COMPLETED` along with the response body.
   - **Concurrent Request (Same time)**: Returns `409 Conflict` (request already processing).
   - **Retried Request (Network drop / User refresh)**: Key is found with status `COMPLETED`. The server immediately returns the **cached response body** without re-executing order creation or charging the card again!
   - **Key Re-use with Different Payload**: If the client sends the same key but different order data, it throws `400 Bad Request`.

---

## 2. Race Conditions & Prevention
A **race condition** occurs when two concurrent requests try to read and update the same record at the same time.

**Example without lock:**
1. Request A reads `Order #100 (Status: PENDING)`
2. Request B reads `Order #100 (Status: PENDING)`
3. Request A updates balance and marks `PAID`
4. Request B updates balance and marks `PAID` -> **Double processing!**

**Solution implemented:**
- **Pessimistic Locking (`SELECT FOR UPDATE`)**: In `order.service.ts`:
  ```typescript
  manager.getRepository(Order)
    .createQueryBuilder('order')
    .setLock('pessimistic_write') // Locks row at DB level
    .where('order.transactionId = :transactionId', { transactionId })
    .getOne();
  ```
  While Request A holds the lock, Request B waits until transaction A commits or rolls back.
- **Unique DB Constraints**: Unique indices on `transactionId` and `(key, endpoint)` at the database level make duplicate inserts physically impossible.

---

## 3. Rate Limiting
Prevents API abuse, brute-force attacks, and server exhaustion by limiting requests per IP within a time window.
- Configured globally with `@nestjs/throttler`: `limit: 60 requests / 60 seconds`.
- Tailored per endpoint (e.g., Order creation has `@Throttle({ default: { limit: 5, ttl: 60000 } })`).

---

## 4. Webhooks & Mock PhonePe Gateway
A **Webhook** is an automated reverse HTTP call where PhonePe sends real-time payment status updates to your server.

**Challenges & Solutions:**
1. **Spoofed Webhooks**: Attacker sends fake `SUCCESS` callback.
   - *Fix*: Checksum signature verification using PhonePe's algorithm `SHA256(payload + saltKey)###saltIndex`.
2. **Repeated Webhooks**: PhonePe retries webhooks until it receives a 200 OK.
   - *Fix*: `webhook_events` table stores `eventId` with a unique index. Duplicate deliveries are safely skipped.
3. **Simultaneous Webhook & User Redirect**: Both can hit at the exact same millisecond.
   - *Fix*: Handled by row-level DB lock and idempotent state check (`if status === PAID return`).

---

## 5. API Testing Walkthrough

### Step 1: Create an Order (Idempotent)
- **POST** `http://localhost:3000/orders`
- **Headers**:
  ```http
  Content-Type: application/json
  Idempotency-Key: test-order-uuid-001
  ```
- **Body**:
  ```json
  {
    "userId": "user_123",
    "amount": 500
  }
  ```
> *Test Idempotency*: Send this exact request again with the same `Idempotency-Key`. Notice you get back the exact same order with header `X-Cache-Lookup: HIT - Replayed Idempotent Response`. No duplicate row is added to the database.

---

### Step 2: Initiate Payment (PhonePe Payload & Checksum)
- **POST** `http://localhost:3000/payments/initiate`
- **Body**:
  ```json
  {
    "orderId": "<ORDER_ID_FROM_STEP_1>"
  }
  ```

---

### Step 3: Test Webhook Idempotency & Signature
1. Generate test payload and signature:
   - **POST** `http://localhost:3000/payments/mock-generate-webhook-payload`
   - **Body**:
     ```json
     {
       "merchantTransactionId": "<TRANSACTION_ID_FROM_STEP_1>",
       "status": "SUCCESS"
     }
     ```
2. Trigger the PhonePe Webhook:
   - **POST** `http://localhost:3000/payments/webhook`
   - **Headers**:
     ```http
     Content-Type: application/json
     X-VERIFY: <xVerifyHeader_FROM_STEP_3.1>
     ```
   - **Body**:
     ```json
     {
       "response": "<response_FROM_STEP_3.1>"
     }
     ```
3. *Test Webhook Idempotency*: Send the webhook request a second time. The server will detect duplicate event receipt and return:
   ```json
   {
     "success": true,
     "message": "Webhook event already processed (Idempotency check passed)."
   }
   ```

