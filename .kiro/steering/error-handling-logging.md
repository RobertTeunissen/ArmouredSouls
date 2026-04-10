---
inclusion: fileMatch
fileMatchPattern: "**/backend/src/**,**/middleware/**,**/services/**,**/*error*,**/*logger*"
---

# Error Handling and Logging Standards

## Error Handling Strategy

### Error Categories

**User Errors (4xx)**
- Invalid input data
- Authentication failures
- Authorization failures
- Resource not found
- Business rule violations

**System Errors (5xx)**
- Database connection failures
- External service failures
- Unexpected exceptions
- Configuration errors
- Resource exhaustion

### Error Response Format

**Standard API Error Response**:
```typescript
{
  error: string;       // Human-readable message
  code: string;        // Machine-readable error code
  details?: unknown;   // Optional structured data
}
```

**Error Class Hierarchy**:
All service errors extend the base `AppError` class in `src/errors/AppError.ts`:
```
Error
└── AppError (code, statusCode, details)
    ├── AuthError
    ├── RobotError
    ├── BattleError
    ├── EconomyError
    ├── LeagueError
    ├── TournamentError
    ├── TagTeamError
    ├── KothError
    └── OnboardingError
```

**Error Codes by Domain**:
- `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, etc. - Auth errors
- `ROBOT_NOT_FOUND`, `ROBOT_NOT_OWNED`, etc. - Robot errors
- `BATTLE_NOT_FOUND`, `BATTLE_SIMULATION_FAILED`, etc. - Battle errors
- `INSUFFICIENT_CREDITS`, `FACILITY_MAX_LEVEL`, etc. - Economy errors
- `LEAGUE_NOT_FOUND`, `PROMOTION_BLOCKED`, etc. - League errors
- `TOURNAMENT_NOT_FOUND`, `INSUFFICIENT_PARTICIPANTS`, etc. - Tournament errors
- `TAG_TEAM_NOT_FOUND`, `INVALID_TEAM_COMPOSITION`, etc. - Tag team errors
- `KOTH_NOT_FOUND`, `INSUFFICIENT_KOTH_PARTICIPANTS`, etc. - KotH errors

See `docs/guides/ERROR_CODES.md` for the complete error code reference.

### Error Handling Implementation

**Backend Service Layer** - Throw domain-specific errors:
```typescript
import { RobotError, RobotErrorCode } from '../errors/robotErrors';

async function getRobot(robotId: number, userId: number) {
  const robot = await prisma.robot.findUnique({ where: { id: robotId } });
  
  if (!robot) {
    throw new RobotError(
      RobotErrorCode.ROBOT_NOT_FOUND,
      `Robot ${robotId} not found`,
      404,
      { robotId }
    );
  }
  
  if (robot.userId !== userId) {
    throw new RobotError(
      RobotErrorCode.ROBOT_NOT_OWNED,
      'Robot belongs to another user',
      403,
      { robotId, ownerId: robot.userId }
    );
  }
  
  return robot;
}
```

**Route Handlers** - Let errors propagate to middleware (Express 5):
```typescript
// Express 5 automatically catches rejected promises - no try-catch needed
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }
  
  const robot = await getRobot(parseInt(req.params.id), req.user.userId);
  res.json(robot);
});
```

**Error Handler Middleware** (`src/middleware/errorHandler.ts`):
```typescript
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Structured app errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Prisma known errors (P2002, P2025, etc.)
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    // Map to appropriate HTTP status and code
  }

  // Unknown errors → 500 INTERNAL_ERROR
  res.status(500).json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
}
```

**Frontend Error Handling**:

All API errors are normalized into `ApiError` instances by the `api` helper. Use the `code` property to switch on machine-readable error codes:

```typescript
import { ApiError } from '../utils/ApiError';

try {
  const response = await api.performAction();
  // Handle success
} catch (err) {
  if (err instanceof ApiError) {
    // Switch on machine-readable error code
    switch (err.code) {
      case 'INSUFFICIENT_CREDITS':
        showToast('Not enough credits for this purchase');
        break;
      case 'ROBOT_NOT_FOUND':
        showToast('Robot no longer exists');
        navigate('/robots');
        break;
      case 'UNAUTHORIZED':
        redirectToLogin();
        break;
      case 'NETWORK_ERROR':
        showToast('Network error - please check your connection');
        break;
      default:
        showToast(err.message || 'An unexpected error occurred');
    }
  }
}
```

**ApiError Properties**:
- `message` - Human-readable error message
- `code` - Machine-readable error code (e.g., `ROBOT_NOT_FOUND`, `INSUFFICIENT_CREDITS`)
- `statusCode` - HTTP status code (0 for network errors)
- `details` - Optional structured data from backend (e.g., `{ blockers: [...] }`)

**Special Error Codes**:
- `NETWORK_ERROR` - Request failed before reaching server (statusCode: 0)
- `UNKNOWN_ERROR` - Server returned non-structured error response

See `docs/guides/ERROR_CODES.md` for the complete list of backend error codes.
```

### Error Boundaries (React)

**Implement error boundaries for component failures**:
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

## Logging Standards

### Log Levels

**DEBUG** (development only)
- Detailed diagnostic information
- Variable values and state
- Function entry/exit points
- Never in production

**INFO**
- Normal application flow
- Significant events (user login, cycle completion)
- Configuration changes
- Startup/shutdown events

**WARN**
- Recoverable errors
- Deprecated API usage
- Performance degradation
- Unusual but handled situations

**ERROR**
- Unhandled exceptions
- Failed operations
- Data integrity issues
- External service failures

**FATAL** (rare)
- Application cannot continue
- Critical system failures
- Data corruption detected

### Logging Format

**Structured Logging (JSON)**:
```typescript
{
  timestamp: "2026-03-02T10:30:00.123Z",
  level: "ERROR",
  message: "Battle calculation failed",
  context: {
    userId: 123,
    battleId: 456,
    robot1Id: 789,
    robot2Id: 890
  },
  error: {
    message: "Division by zero",
    stack: "Error: Division by zero\n  at calculateDamage..."
  },
  environment: "production",
  service: "battle-service"
}
```

### What to Log

**Always Log**:
- Authentication attempts (success and failure)
- Authorization failures
- Database errors
- External API failures
- Unhandled exceptions
- Critical business operations (battles, transactions)
- Configuration changes
- Deployment events

**Never Log**:
- Passwords (plain or hashed)
- JWT tokens
- API keys or secrets
- Credit card numbers
- Personal identification numbers
- Full request/response bodies (may contain sensitive data)

**Conditionally Log** (development only):
- Request/response payloads
- Database query parameters
- Detailed stack traces
- Debug information

### Logging Implementation

**Backend Logger Setup**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'armouredsouls-backend',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

**Usage Examples**:
```typescript
// Info logging
logger.info('User logged in', { userId: user.id, username: user.username });

// Warning logging
logger.warn('Slow query detected', { 
  query: 'SELECT * FROM battles',
  duration: 2500,
  threshold: 1000
});

// Error logging
logger.error('Battle calculation failed', {
  battleId: battle.id,
  error: error.message,
  stack: error.stack,
  context: { robot1Id, robot2Id }
});
```

### Performance Logging

**Track Critical Operations**:
```typescript
const startTime = Date.now();
try {
  const result = await performExpensiveOperation();
  const duration = Date.now() - startTime;
  
  if (duration > 1000) {
    logger.warn('Slow operation detected', {
      operation: 'performExpensiveOperation',
      duration,
      threshold: 1000
    });
  }
  
  return result;
} catch (error) {
  const duration = Date.now() - startTime;
  logger.error('Operation failed', {
    operation: 'performExpensiveOperation',
    duration,
    error: error.message
  });
  throw error;
}
```

## Error Monitoring

### Production Error Tracking

**Requirements**:
- Aggregate errors by type and frequency
- Track error trends over time
- Alert on error rate spikes
- Capture stack traces and context
- Link errors to specific deployments

**Recommended Tools**:
- Sentry (error tracking)
- LogRocket (session replay)
- Datadog (APM and logging)
- CloudWatch (AWS environments)

### Error Alerting Thresholds

**Immediate Alert** (critical):
- Authentication system down
- Database connection failures
- Payment processing errors
- Data corruption detected

**Hourly Alert** (high priority):
- Error rate > 5% of requests
- API response time > 2 seconds (p95)
- Failed cycle executions
- External service failures

**Daily Alert** (monitoring):
- Error rate > 1% of requests
- Slow query count increasing
- Memory usage trending up
- Disk space < 20%

## Debugging Best Practices

### Development Debugging

**Use Proper Logging**:
```typescript
// BAD - Will be committed accidentally
console.log('User data:', user);

// GOOD - Proper logger with context
logger.debug('Processing user data', { userId: user.id });
```

**Conditional Debug Logging**:
```typescript
if (process.env.DEBUG_BATTLES === 'true') {
  logger.debug('Battle state', {
    battleId,
    round,
    robot1HP,
    robot2HP,
    damageCalculation
  });
}
```

### Production Debugging

**Enable Debug Mode Temporarily**:
- Use environment variable to enable verbose logging
- Restart service with DEBUG=true
- Collect logs for specific time period
- Disable debug mode after investigation

**Never**:
- Leave debug logging enabled in production
- Log sensitive data even in debug mode
- Use console.log in production code
- Expose internal errors to users

## Error Recovery Strategies

### Retry Logic

**Implement for Transient Failures**:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      logger.warn('Operation failed, retrying', {
        attempt,
        maxRetries,
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
}
```

### Circuit Breaker Pattern

**Prevent Cascading Failures**:
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= 5) {
      this.state = 'OPEN';
      logger.error('Circuit breaker opened', { failures: this.failures });
    }
  }
}
```

## Checklist

### Before Committing
- [ ] No console.log statements in code
- [ ] Proper error handling with try-catch
- [ ] Errors logged with appropriate level
- [ ] Sensitive data not logged
- [ ] User-friendly error messages
- [ ] Error codes defined and documented

### Before Deploying
- [ ] Log level set appropriately for environment
- [ ] Error monitoring configured
- [ ] Alert thresholds defined
- [ ] Error recovery strategies implemented
- [ ] Debug logging disabled in production

## Security Logging Channel

### Overview

A dedicated security logger writes structured JSON events to `logs/security.log`, separate from the main application log. This keeps security events on an independent channel for audit and alerting purposes.

The security logger is implemented in `src/services/security/securityLogger.ts` and used by the `SecurityMonitor` singleton (`src/services/security/securityMonitor.ts`).

### SecurityEvent Format

All security events conform to this interface:

```typescript
interface SecurityEvent {
  severity: 'info' | 'warning' | 'critical';
  eventType: string;        // e.g., 'rapid_spending', 'authorization_failure', 'validation_failure'
  userId?: number;
  sourceIp?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  timestamp: string;        // ISO 8601
}
```

### Severity Levels

| Severity | When Used |
|----------|-----------|
| `info` | Normal security-relevant events (spending tracked, validation failure, robot creation) |
| `warning` | Anomalous patterns detected (race condition attempts, automated creation, rate limit escalation, authorization failures) |
| `critical` | Potential active exploit (rapid spending >3M credits in 5 minutes) |

### Event Types

| Event Type | Severity | Trigger |
|------------|----------|---------|
| `spending` | info | Any credit-spending operation |
| `rapid_spending` | critical | Cumulative spending >3M in 5-minute window |
| `conflict` | info | HTTP 409 conflict response |
| `race_condition_attempt` | warning | >10 conflicts in 1 minute for same user |
| `authorization_failure` | warning | HTTP 403 ownership check failure |
| `validation_failure` | info | Schema validation rejection |
| `robot_creation` | info | Robot created |
| `automated_robot_creation` | warning | >3 robots created in 10 minutes |
| `rate_limit_violation` | info | Rate limit hit |
| `rate_limit_escalation` | warning | >5 rate limit hits in 1 hour |
| `admin_password_reset` | info | Successful admin password reset |
| `admin_password_reset_pattern` | warning | ≥5 admin password resets affecting ≥3 distinct target users within 15 minutes by the same admin |

### Transport Configuration

The security logger uses a dedicated Winston file transport:

```typescript
const securityTransport = new winston.transports.File({
  filename: 'logs/security.log',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});
```

Security events are not written to the main application log or database. The `logs/security.log` file is the single source of truth for security audit trails. The `SecurityMonitor` also keeps the last 500 events in memory for the admin dashboard (`GET /api/admin/security/events`).
