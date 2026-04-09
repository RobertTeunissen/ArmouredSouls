# Module Contract: @armoured-souls/auth

## Purpose

Authentication, authorization, and user management. Owns JWT token handling, password hashing, user CRUD, and the Express authentication middleware.

## Dependencies

- `@armoured-souls/database` — User model access, Prisma client

## Exported Public API

### Middleware

```typescript
// Express middleware that validates JWT and attaches user to request
export { authenticateToken } from './middleware/auth';
export { requireAdmin } from './middleware/auth';
export type { AuthRequest } from './middleware/auth';
```

### User Management

```typescript
// User creation, lookup, profile updates
export { userService } from './services/userService';
```

### Token Utilities

```typescript
// JWT generation and validation
export { generateToken, verifyToken } from './services/jwtService';
```

### Password Utilities

```typescript
// Bcrypt hashing and comparison
export { hashPassword, comparePassword } from './services/passwordService';
```

### Error Types

```typescript
export { AuthError, AuthErrorCode } from './errors/authErrors';
```

## Internal Implementation (Not Exported)

- Salt round configuration (10 dev, 12 prod)
- Token expiration settings (24h)
- JWT secret management

## Current Source Location

| Target | Current Location |
|--------|-----------------|
| `auth middleware` | `prototype/backend/src/middleware/auth.ts` |
| `jwtService` | `prototype/backend/src/services/auth/jwtService.ts` |
| `passwordService` | `prototype/backend/src/services/auth/passwordService.ts` |
| `userService` | `prototype/backend/src/services/auth/userService.ts` |
| `AuthError` | `prototype/backend/src/errors/authErrors.ts` |

## External Package Dependencies

- `jsonwebtoken` — JWT signing/verification
- `bcrypt` — Password hashing
