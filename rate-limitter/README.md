# Rate Limiter & Auth Backend (NestJS + TypeScript)

This project provides a robust NestJS backend setup with **Rate Limiting** via `@nestjs/throttler` and MySQL persistence via **TypeORM**.

---

## 🚀 Features

- **Framework**: NestJS (TypeScript)
- **Database**: MySQL (via TypeORM, Database: `redis`)
- **Rate Limiting**: `@nestjs/throttler` with `ThrottlerGuard`
  - Global baseline: 20 req/min
  - `POST /auth/signup`: **Max 3 requests / 60 seconds**
  - `POST /auth/login`: **Max 5 requests / 60 seconds** (Brute-force protection)
  - Exceeding limit returns `HTTP 429 Too Many Requests` with `Retry-After` header.
- **Authentication**:
  - `POST /auth/signup`: Registers a new user with email and hashed password (via `bcryptjs`).
  - `POST /auth/login`: Authenticates user credentials with email and password, returning an access token.
- **Validation**: Strict DTO validation with `class-validator` and `class-transformer`.

---

## ⚙️ Environment Configuration

Set the following environment variables (or place them in your environment):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=2
DB_DATABASE=redis
PORT=3000
```

---

## 🛠️ API Endpoints

### 1. User Signup
- **URL**: `POST /auth/signup`
- **Rate Limit**: Max 3 calls per 60 seconds
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "secretpassword"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "message": "User registered successfully",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "createdAt": "2026-10-19T10:00:00.000Z",
      "updatedAt": "2026-10-19T10:00:00.000Z"
    }
  }
  ```

---

### 2. User Login
- **URL**: `POST /auth/login`
- **Rate Limit**: Max 5 calls per 60 seconds
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "secretpassword"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "message": "Login successful",
    "user": {
      "id": 1,
      "email": "user@example.com"
    },
    "token": "bearer-token-1-171888..."
  }
  ```

---

### 3. Rate Limit Exceeded Response (`429 Too Many Requests`)
When exceeding the rate limit threshold within the 60-second window:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```
Headers returned:
- `Retry-After: 55`

---

## 🏃 Running the Application

```bash
# Start in development mode with auto-reload
npm run start:dev

# Or standard start
npm start

# Type check & build
npm run build
```
