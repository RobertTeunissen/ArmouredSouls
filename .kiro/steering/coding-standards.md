---
inclusion: always
---

# Coding Standards for Armoured Souls

## TypeScript Standards

### Type Safety
- Always use explicit types, avoid `any` unless absolutely necessary
- Use interfaces for object shapes, types for unions/intersections
- Leverage TypeScript's strict mode features
- Define return types for all functions

### Naming Conventions
- **Files**: kebab-case (e.g., `robot-service.ts`)
- **Classes**: PascalCase (e.g., `RobotService`)
- **Functions/Variables**: camelCase (e.g., `calculateDamage`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_WEAPON_SLOTS`)
- **Interfaces**: PascalCase with descriptive names (e.g., `RobotAttributes`)
- **Database tables**: snake_case (e.g., `robot_weapons`)

### Code Organization
- One class/interface per file (with exceptions for tightly coupled types)
- Group related functionality into services
- Keep functions focused and single-purpose
- Maximum function length: ~50 lines (guideline, not strict rule)

## Framework-Specific Standards

### Prisma 7
- Import Prisma client from the project-local `generated/prisma` directory, NOT from `@prisma/client`
- Example: `import { PrismaClient } from '../generated/prisma'`
- The generated client lives at `prototype/backend/generated/prisma/`
- Run `npx prisma generate` after schema changes to regenerate the client
- **Driver Adapter Required**: Prisma 7 uses the `client` engine type by default, which requires a driver adapter. Always pass an adapter to the PrismaClient constructor:
  ```typescript
  import { PrismaClient } from '../generated/prisma';
  import { PrismaPg } from '@prisma/adapter-pg';
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  ```
- The main app singleton in `src/lib/prisma.ts` handles this automatically — import from there for application code
- Standalone scripts and integration tests must create their own adapter instance

### Express 5
- Async errors in route handlers are caught automatically — no need for manual try-catch wrappers around async route handlers for promise rejections
- Express 5 forwards rejected promises to the error-handling middleware automatically
- `req.param()` is removed — use `req.params`, `req.body`, or `req.query` instead
- Path patterns use stricter matching (updated path-to-regexp)

### React 19
- Use `ref` as a regular prop — `forwardRef` is no longer needed
- Use JS default parameters instead of `defaultProps` on function components
- Use `@testing-library/react` for component testing — `react-dom/test-utils` is removed
- New hooks available: `use()`, `useActionState`, `useOptimistic`

### Testing Frameworks
- Backend: Jest 30 with ts-jest for TypeScript support
- Frontend: Vitest 4 with `@vitest/coverage-v8` for coverage
- Both: fast-check for property-based testing

## Backend Standards

### API Design
- RESTful endpoints with consistent naming
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate status codes
- Include error messages in consistent format
- Validate all inputs

### Database Interactions
- Use parameterized queries to prevent SQL injection
- Handle database errors gracefully
- Use transactions for multi-step operations
- Include proper indexes for performance

### Error Handling
- Use try-catch blocks for async operations
- Log errors with context
- Return user-friendly error messages
- Don't expose internal implementation details in errors

## Frontend Standards

### React Components
- Functional components with hooks
- Props interfaces defined for all components
- Keep components focused and reusable
- Use meaningful component names

### State Management
- Local state for component-specific data
- Context for shared application state
- Avoid prop drilling

### Styling
- Follow design system guidelines (see docs/design_ux/)
- Use consistent spacing and layout patterns
- Ensure responsive design
- Maintain accessibility standards

## Testing Requirements

### Mandatory Testing
- **Always write tests** for all new code and features
- **Minimum coverage**: 80% for general code, 90% for critical functionality
- **Critical functionality**: Combat, economy, matchmaking, leagues, auth, database operations
- **Run all tests** after completing development: `npm test`
- **Verify coverage**: `npm test -- --coverage`

### Test Standards
- Use descriptive test names following pattern: "should [expected behavior] when [condition]"
- Mock external dependencies (database, APIs)
- Keep tests fast and focused
- Write unit tests for individual functions
- Write integration tests for workflows
- Add regression tests for bug fixes
- Run with `--maxWorkers=1` if encountering parallel test conflicts
- Use `npm test -- --silent` in CI/CD pipelines to reduce output verbosity

### Before Committing
1. Run full test suite and verify all tests pass
2. Check coverage meets minimum thresholds
3. Fix any failing tests
4. Do not commit untested code

## Documentation Requirements
- Document complex algorithms and business logic
- Include JSDoc comments for public APIs
- Update relevant PRD documents when changing features
- Keep README files current

## Security Practices

### Critical Security Rules
- **Never commit secrets** - Use .env files (gitignored)
- **Validate all inputs** - Never trust user input
- **Use parameterized queries** - Prevent SQL injection via Prisma
- **Hash passwords** - bcrypt with salt rounds 10-12
- **Secure JWT tokens** - Strong secrets, short expiration
- **HTTPS only** - Enforce in production (Caddy handles this)
- **Rate limiting** - Protect auth endpoints (30 req/min)
- **CORS configuration** - Whitelist specific origins only

### Authentication & Authorization
- JWT tokens with 24h expiration
- Bcrypt password hashing (10 rounds in dev, 12 in prod)
- Role-based access control (admin, user)
- Middleware for protected routes
- Token validation on every request

### Input Validation
- Validate at API boundary (Express middleware)
- Use Zod or Joi for schema validation
- Sanitize user-generated content
- Validate file uploads (type, size)
- Check for SQL injection patterns (Prisma handles this)

### Sensitive Data Handling
- Never log passwords or tokens
- Mask sensitive data in error messages
- Use environment variables for secrets
- Rotate secrets periodically
- Different secrets per environment

### OWASP Top 10 Compliance
See `docs/guides/SECURITY.md` for comprehensive security strategy covering:
- Injection prevention
- Broken authentication
- Sensitive data exposure
- XML external entities (XXE)
- Broken access control
- Security misconfiguration
- Cross-site scripting (XSS)
- Insecure deserialization
- Using components with known vulnerabilities
- Insufficient logging and monitoring

## Performance Considerations
- Optimize database queries (use EXPLAIN when needed)
- Implement pagination for large datasets
- Cache frequently accessed data when appropriate
- Monitor and log performance metrics
