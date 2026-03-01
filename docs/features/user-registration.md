# User Registration Module — Developer Guide

This guide covers the architecture, data flows, setup instructions, and integration points for the user registration module. It is aimed at developers who need to understand, maintain, or extend the registration and authentication system.

For endpoint schemas see the [OpenAPI specification](../api/authentication.yaml).
For error codes and troubleshooting see the [Error Reference](./user-registration-error-reference.md).

---

## Architecture Overview

The registration module follows a layered architecture with clear separation between presentation, API, business logic, and data layers.

```mermaid
graph TD
    subgraph Frontend
        FP[FrontPage]
        RF[RegistrationForm]
        LF[LoginForm]
        AC[AuthContext]
    end

    subgraph Backend API
        REG[POST /api/auth/register]
        LOG[POST /api/auth/login]
    end

    subgraph Middleware
        RL[Rate Limiter]
    end

    subgraph Services
        VS[Validation Service]
        US[User Service]
        PS[Password Service]
        JS[JWT Service]
    end

    subgraph Data
        DB[(Database — User table)]
    end

    FP --> RF
    FP --> LF
    RF -->|POST| REG
    LF -->|POST| LOG
    REG --> RL
    LOG --> RL
    RL --> VS
    RL --> US
    US --> PS
    US --> DB
    REG --> JS
    LOG --> JS
    RF -->|token + user| AC
    LF -->|token + user| AC
```

### File Map

| Layer | Component | Path |
|-------|-----------|------|
| Frontend | FrontPage | `prototype/frontend/src/pages/FrontPage.tsx` |
| Frontend | RegistrationForm | `prototype/frontend/src/components/RegistrationForm.tsx` |
| Frontend | LoginForm | `prototype/frontend/src/components/LoginForm.tsx` |
| Frontend | AuthContext | `prototype/frontend/src/contexts/AuthContext.tsx` |
| Backend | Auth routes | `prototype/backend/src/routes/auth.ts` |
| Backend | Validation Service | `prototype/backend/src/utils/validation.ts` |
| Backend | User Service | `prototype/backend/src/services/userService.ts` |
| Backend | Password Service | `prototype/backend/src/services/passwordService.ts` |
| Backend | JWT Service | `prototype/backend/src/services/jwtService.ts` |
| Backend | Rate Limiter | `prototype/backend/src/middleware/rateLimiter.ts` |
| Data | Prisma client | `prototype/backend/src/lib/prisma.ts` |

---

## Data Flow: Registration

```mermaid
sequenceDiagram
    actor User
    participant FP as FrontPage
    participant RF as RegistrationForm
    participant API as POST /api/auth/register
    participant RL as Rate Limiter
    participant VS as Validation Service
    participant US as User Service
    participant PS as Password Service
    participant JWT as JWT Service
    participant DB as Database
    participant AC as AuthContext

    User->>FP: Selects "Register"
    FP->>RF: Renders registration form
    User->>RF: Fills username, email, password, confirm password
    RF->>RF: Validates password confirmation match
    RF->>API: POST { username, email, password }
    API->>RL: Check rate limit
    RL-->>API: OK / 429

    API->>VS: validateRegistrationRequest()
    VS-->>API: ValidationResult

    alt Validation fails
        API-->>RF: 400 { error, code: "VALIDATION_ERROR" }
        RF-->>User: Display error message
    end

    API->>US: findUserByUsername(username)
    US->>DB: SELECT by username
    DB-->>US: User | null

    alt Username taken
        API-->>RF: 400 { error, code: "DUPLICATE_USERNAME" }
    end

    API->>US: findUserByEmail(email)
    US->>DB: SELECT by email
    DB-->>US: User | null

    alt Email taken
        API-->>RF: 400 { error, code: "DUPLICATE_EMAIL" }
    end

    API->>PS: hashPassword(password)
    PS-->>API: bcrypt hash

    API->>US: createUser({ username, email, passwordHash })
    US->>DB: INSERT user (defaults: currency=1000, prestige=0, role=player)
    DB-->>US: Created user

    API->>JWT: generateToken({ id, username, role })
    JWT-->>API: JWT string

    API-->>RF: 201 { token, user }
    RF->>AC: Update auth state (token + user profile)
    RF->>FP: Navigate to dashboard
    FP-->>User: Dashboard view
```

---

## Data Flow: Login

```mermaid
sequenceDiagram
    actor User
    participant FP as FrontPage
    participant LF as LoginForm
    participant API as POST /api/auth/login
    participant RL as Rate Limiter
    participant US as User Service
    participant PS as Password Service (bcrypt)
    participant JWT as JWT Service
    participant DB as Database
    participant AC as AuthContext

    User->>FP: Selects "Login"
    FP->>LF: Renders login form
    User->>LF: Enters identifier + password
    LF->>API: POST { identifier, password }
    API->>RL: Check rate limit
    RL-->>API: OK / 429

    API->>US: findUserByIdentifier(identifier)
    US->>DB: SELECT by username
    DB-->>US: User | null

    alt Not found by username
        US->>DB: SELECT by email
        DB-->>US: User | null
    end

    alt User not found
        API-->>LF: 401 { error: "Invalid credentials" }
        LF-->>User: Display error
    end

    API->>PS: bcrypt.compare(password, user.passwordHash)
    PS-->>API: boolean

    alt Password mismatch
        API-->>LF: 401 { error: "Invalid credentials" }
    end

    API->>JWT: sign({ userId, username, role })
    JWT-->>API: JWT string

    API-->>LF: 200 { token, user }
    LF->>AC: Update auth state (token + user profile)
    LF->>FP: Navigate to dashboard
    FP-->>User: Dashboard view
```

> The login endpoint accepts an `identifier` field that can be either a username or an email address. It also supports a legacy `username` field for backward compatibility (`identifier || username`).

---

## Authentication Flow

```mermaid
flowchart TD
    Start([User visits FrontPage]) --> Choice{Register or Login?}

    Choice -->|Register| RegForm[Fill registration form]
    Choice -->|Login| LogForm[Fill login form]

    RegForm --> ConfirmPW{Passwords match?}
    ConfirmPW -->|No| PWError[Show mismatch error]
    PWError --> RegForm
    ConfirmPW -->|Yes| PostReg[POST /api/auth/register]

    LogForm --> PostLog[POST /api/auth/login]

    PostReg --> RateCheck1{Rate limit OK?}
    RateCheck1 -->|No| R429[429 Too Many Requests]
    RateCheck1 -->|Yes| Validate[Validate inputs]

    Validate --> Valid{Valid?}
    Valid -->|No| R400[400 Validation Error]
    Valid -->|Yes| DupCheck[Check duplicates]

    DupCheck --> Dup{Duplicate?}
    Dup -->|Yes| R400Dup[400 Duplicate Error]
    Dup -->|No| Hash[Hash password with bcrypt]

    Hash --> CreateUser[Insert user into DB]
    CreateUser --> GenToken1[Generate JWT]
    GenToken1 --> Return201[201 — token + user profile]

    PostLog --> RateCheck2{Rate limit OK?}
    RateCheck2 -->|No| R429
    RateCheck2 -->|Yes| FindUser[Find user by identifier]

    FindUser --> Found{User found?}
    Found -->|No| R401[401 Invalid credentials]
    Found -->|Yes| VerifyPW[Verify password]

    VerifyPW --> PWOk{Password correct?}
    PWOk -->|No| R401
    PWOk -->|Yes| GenToken2[Generate JWT]
    GenToken2 --> Return200[200 — token + user profile]

    Return201 --> StoreToken[Store token in localStorage]
    Return200 --> StoreToken
    StoreToken --> UpdateCtx[Update AuthContext]
    UpdateCtx --> Dashboard([Redirect to Dashboard])

    R400 --> ShowErr[Display error in form]
    R400Dup --> ShowErr
    R401 --> ShowErr
    R429 --> ShowErr
```

---

## Setup Instructions

### 1. Environment Variables

Create or update your `.env` file in the backend root (`prototype/backend/`):

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/armoured_souls"

# JWT
JWT_SECRET="your-strong-secret-key-min-256-bits"
JWT_EXPIRATION="24h"

# Bcrypt
BCRYPT_SALT_ROUNDS=10

# Rate Limiting (shared between register and login)
RATE_LIMIT_WINDOW_MS=3600000   # 1 hour in milliseconds
RATE_LIMIT_MAX_REQUESTS=5
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `dev-secret-change-in-production` | Secret key for signing JWTs. Use a strong random value in production. |
| `JWT_EXPIRATION` | No | `24h` | Token lifetime (e.g. `7d`, `24h`) |
| `BCRYPT_SALT_ROUNDS` | No | `10` | bcrypt cost factor. Higher = slower + more secure. |
| `RATE_LIMIT_WINDOW_MS` | No | `3600000` | Rate limit window in ms |
| `RATE_LIMIT_MAX_REQUESTS` | No | `5` | Max requests per window per IP |

### 2. Database Migration

The registration module adds an `email` column to the existing `users` table.

```bash
# From the backend directory
cd prototype/backend

# Run Prisma migrations
npx prisma migrate deploy

# (Development only) Generate Prisma client after schema changes
npx prisma generate
```

The migration performs three steps:

1. Adds `email` column as `VARCHAR(50)`, initially nullable
2. Populates existing users with placeholder emails (`{username}@legacy.local`)
3. Creates a unique index on the `email` column

To verify the migration succeeded:

```sql
SELECT id, username, email FROM "User" LIMIT 5;
```

### 3. Install Dependencies

```bash
# Backend
cd prototype/backend
npm install

# Frontend
cd prototype/frontend
npm install
```

Key dependencies used by this module:

| Package | Purpose |
|---------|---------|
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT generation and verification |
| `express-rate-limit` | Rate limiting middleware |
| `@prisma/client` | Database ORM |

### 4. Run Tests

```bash
# Backend unit + integration tests
cd prototype/backend
npx vitest --run

# Frontend component tests
cd prototype/frontend
npx vitest --run
```

### 5. Start Development Servers

```bash
# Backend (from prototype/backend)
npm run dev

# Frontend (from prototype/frontend)
npm run dev
```

---

---

## Integration Guide

This section shows how to call the registration and login APIs, integrate with the existing authentication system, extend validation rules, and customize default user values.

### Calling the Registration API

Register a new user by sending a `POST` request to `/api/auth/register` with a JSON body containing `username`, `email`, and `password`.

**cURL example:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_player",
    "email": "player_email",
    "password": "securepass123"
  }'
```

**Success response (201 Created):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 42,
    "username": "new_player",
    "email": "player_email",
    "currency": 3000000,
    "prestige": 0,
    "role": "user"
  }
}
```

**TypeScript / fetch example:**

```typescript
async function registerUser(username: string, email: string, password: string) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
    const body = await response.json();
    // body.error  — human-readable message
    // body.code   — machine-readable code (e.g. "VALIDATION_ERROR", "DUPLICATE_USERNAME")
    throw new Error(body.error);
  }

  const { token, user } = await response.json();
  // Store token and use user profile as needed
  return { token, user };
}
```

### Calling the Login API

Log in by sending a `POST` request to `/api/auth/login`. The `identifier` field accepts either a username or an email address. A legacy `username` field is also supported for backward compatibility.

```bash
# Login with username
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "identifier": "new_player", "password": "securepass123" }'

# Login with email
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "identifier": "player_email", "password": "securepass123" }'
```

**Success response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 42,
    "username": "new_player",
    "email": "player_email",
    "role": "user",
    "currency": 3000000,
    "prestige": 0
  }
}
```

Both endpoints return the same user profile shape, so client code can handle registration and login responses identically.

For the full list of error codes and recommended client handling, see the [Error Code Reference](./user-registration-error-reference.md).

### Integrating with the Existing Authentication System

The registration module plugs into the existing `AuthContext` that manages authentication state across the React frontend.

**How it works:**

1. `RegistrationForm` accepts an `onSuccess(token, user)` callback.
2. On successful registration the form calls `onSuccess` with the token and user profile from the API response.
3. The `FrontPage` component wires this callback to `AuthContext` — it stores the token in `localStorage` and updates the user state.

**Wiring registration into AuthContext (simplified):**

```tsx
import { useAuth } from '../contexts/AuthContext';

function FrontPage() {
  const { login } = useAuth();

  const handleRegistrationSuccess = (token: string, user: UserProfile) => {
    // Token is already stored by RegistrationForm; AuthContext picks it up
    // via localStorage. Alternatively call a dedicated register handler.
    localStorage.setItem('token', token);
    // Navigate to dashboard — AuthContext will hydrate from the stored token
    window.location.href = '/dashboard';
  };

  return <RegistrationForm onSuccess={handleRegistrationSuccess} />;
}
```

**AuthContext key points:**

| Concern | Detail |
|---------|--------|
| Token storage | `localStorage.setItem('token', token)` |
| User state | `AuthContext` exposes `user`, `token`, `loading`, `login`, `logout`, `refreshUser` |
| Hydration on reload | On mount, `AuthProvider` reads the token from `localStorage` and calls `/api/user/profile` to restore the user object |
| Login function | `AuthContext.login(identifier, password)` calls `POST /api/auth/login` internally and updates state |

Because the registration and login endpoints return the same user profile shape, any code that consumes `AuthContext.user` works identically regardless of whether the user registered or logged in.

### Extending Validation Rules

Validation functions live in `prototype/backend/src/utils/validation.ts`. Each function returns a `ValidationResult` with an `isValid` flag and an `errors` array.

**Current validation rules:**

| Field | Rule | Function |
|-------|------|----------|
| Username | 3–20 chars, alphanumeric + `_` + `-` | `validateUsername()` |
| Email | 3–50 chars, alphanumeric + `_` + `-` | `validateEmail()` |
| Password | 8–128 chars, no character restrictions | `validateRegistrationPassword()` |

**Adding a new validation rule — example: require username to start with a letter:**

```typescript
// In prototype/backend/src/utils/validation.ts

export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  if (username.length > 20) {
    errors.push('Username must not exceed 20 characters');
  }

  const validCharPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validCharPattern.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  // --- NEW RULE ---
  if (username.length > 0 && !/^[a-zA-Z]/.test(username)) {
    errors.push('Username must start with a letter');
  }

  return { isValid: errors.length === 0, errors };
}
```

The orchestrating function `validateRegistrationRequest()` calls each individual validator and aggregates all errors, so new rules added to any individual function are automatically included in the full request validation.

**Adding an entirely new field validator:**

1. Create a new function following the `ValidationResult` pattern.
2. Call it from `validateRegistrationRequest()` alongside the existing validators.
3. Update the `RegistrationRequest` interface if the field is new.

### Customizing Default User Values

Default values for new accounts are defined in the Prisma schema at `prototype/backend/prisma/schema.prisma`:

```prisma
model User {
  currency  Int    @default(3000000)   // Starting credits (₡3,000,000)
  prestige  Int    @default(0)         // Reputation — earned, never spent
  role      String @default("user")    // Account role
  // ...
}
```

**To change defaults:**

1. Update the `@default(...)` value in the Prisma schema.
2. Generate a new migration:
   ```bash
   cd prototype/backend
   npx prisma migrate dev --name change_default_currency
   ```
3. Regenerate the Prisma client:
   ```bash
   npx prisma generate
   ```

The `createUser()` function in `prototype/backend/src/services/userService.ts` does not explicitly set these fields — it relies on the database defaults. This means changing the schema default is the single source of truth for new account values.

**Setting defaults at the application level instead:**

If you need conditional defaults (e.g., different starting currency for promotional accounts), pass them explicitly in `createUser()`:

```typescript
// In prototype/backend/src/services/userService.ts

export async function createUser(userData: CreateUserData): Promise<User> {
  const user = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      currency: userData.currency ?? undefined, // falls back to schema default if omitted
    },
  });
  return user;
}
```

Then update the `CreateUserData` interface to accept the optional field:

```typescript
export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  currency?: number; // optional override
}
```

### Rate Limiting

Both `/api/auth/register` and `/api/auth/login` share the same `authLimiter` middleware defined in `prototype/backend/src/middleware/rateLimiter.ts`:

| Setting | Value |
|---------|-------|
| Window | 60 seconds |
| Max requests per IP | 10 |

When the limit is exceeded the middleware returns `429 Too Many Requests`. Clients should back off and retry after the window resets.

---

## Related Documentation

- [OpenAPI Specification](../api/authentication.yaml) — full request/response schemas for `/api/auth/register` and `/api/auth/login`
- [Error Code Reference](./user-registration-error-reference.md) — all error codes, messages, client handling, and troubleshooting

---

## Client-Side Validation & Error Display

The registration form implements a two-layer error handling strategy: client-side validation that mirrors backend rules for instant feedback, and server error mapping that routes API error codes to the correct form field.

### Client-Side Validation Rules

These rules run before the form submits, preventing unnecessary server round-trips:

| Field                 | Rule                                                                 |
|-----------------------|----------------------------------------------------------------------|
| Username              | 3–20 chars, alphanumeric + `_` + `-`                                |
| Email                 | 3–50 chars, valid characters, must contain exactly one `@`          |
| Password              | 8–128 chars                                                          |
| Password Confirmation | Must match password field                                            |

These mirror the backend validation in `prototype/backend/src/utils/validation.ts`. When adding new backend validation rules, update the client-side validators in `RegistrationForm.tsx` to match.

### Error Display Behavior

The form uses per-field inline errors instead of a single banner:

| Error Source          | Display Location                                                     |
|-----------------------|----------------------------------------------------------------------|
| Client-side validation| Inline below the specific field, with red border highlight           |
| `DUPLICATE_USERNAME`  | Inline below the username field                                      |
| `DUPLICATE_EMAIL`     | Inline below the email field                                         |
| `VALIDATION_ERROR` (single field) | Inline below the matched field                          |
| `VALIDATION_ERROR` (multi-field)  | General banner above the form                           |
| `DATABASE_ERROR`      | General banner above the form                                        |
| `INTERNAL_ERROR`      | General banner above the form                                        |
| Network failure       | General banner: "Unable to reach the server..."                      |

Error mapping from server codes to fields is handled by `mapServerErrorToField()` in `RegistrationForm.tsx`. Each field input uses `aria-invalid` and `aria-describedby` to link to its inline error message for screen reader accessibility.

Errors clear automatically when the user edits the corresponding field.
