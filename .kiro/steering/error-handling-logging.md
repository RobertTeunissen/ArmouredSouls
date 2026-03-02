---
inclusion: always
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
  success: false,
  error: {
    message: "User-friendly error message",
    code: "ERROR_CODE",
    details?: any, // Optional, only in development
    timestamp: "2026-03-02T10:30:00Z"
  }
}
```

**Error Codes Convention**:
- `AUTH_*` - Authentication/authorization errors
- `VALIDATION_*` - Input validation errors
- `NOT_FOUND_*` - Resource not found errors
- `CONFLICT_*` - Business rule conflicts
- `DATABASE_*` - Database operation errors
- `EXTERNAL_*` - External service errors
- `INTERNAL_*` - Unexpected system errors

### Error Handling Implementation

**Backend Service Layer**:
```typescript
try {
  const result = await performOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', {
    operation: 'performOperation',
    error: error.message,
    stack: error.stack,
    context: { userId, robotId }
  });
  
  if (error instanceof ValidationError) {
    throw new ApiError(400, 'VALIDATION_FAILED', error.message);
  }
  
  throw new ApiError(500, 'INTERNAL_ERROR', 'Operation failed');
}
```

**Frontend Error Handling**:
```typescript
try {
  const response = await api.performAction();
  // Handle success
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 400) {
    // Show validation errors to user
  } else {
    // Show generic error message
    showErrorToast('An unexpected error occurred');
  }
  
  // Log error for debugging
  console.error('Action failed:', error);
}
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
