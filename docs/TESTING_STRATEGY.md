# Armoured Souls - Testing Strategy

## Testing Philosophy

**Test-Driven Development (TDD)**: Write tests before implementation when possible.  
**Comprehensive Coverage**: Aim for >80% code coverage, 100% for critical paths.  
**Automated Testing**: All tests automated in CI/CD pipeline.  
**Fast Feedback**: Quick test execution for rapid development cycles.

---

## Testing Pyramid

```
           ┌──────────────┐
          /    E2E Tests    \     ← Few (10%)
         /   (UI + System)   \      Slow, brittle
        ├────────────────────┤
       /  Integration Tests   \   ← Some (30%)
      /   (API + Database)     \    Medium speed
     ├──────────────────────────┤
    /       Unit Tests          \  ← Many (60%)
   /   (Functions + Classes)     \   Fast, reliable
  └──────────────────────────────┘
```

### Distribution Guidelines
- **Unit Tests**: 60% - Test individual functions, classes, components
- **Integration Tests**: 30% - Test module interactions, API endpoints
- **End-to-End Tests**: 10% - Test complete user workflows

---

## Testing Levels

### 1. Unit Tests

**Scope**: Individual functions, methods, classes in isolation.

**Tools**:
- **JavaScript/TypeScript**: Jest or Vitest
- **Python**: pytest
- **Go**: testing package

**Characteristics**:
- Fast execution (<1ms per test)
- No external dependencies
- Use mocks/stubs for dependencies
- High coverage target (>90%)

**What to Test**:
- Pure functions
- Business logic
- Validation functions
- Utility functions
- Component rendering (React)

**Example Structure**:
```
modules/
  robot/
    src/
      robot.service.ts
    tests/
      robot.service.test.ts
```

**Best Practices**:
- One test file per source file
- Descriptive test names
- Arrange-Act-Assert pattern
- Test edge cases and error conditions
- Keep tests independent

---

### 2. Integration Tests

**Scope**: Multiple modules working together, database interactions, API endpoints.

**Tools**:
- **API Testing**: Supertest, Postman/Newman
- **Database**: Test database with migrations
- **Mocking**: MSW (Mock Service Worker)

**Characteristics**:
- Medium execution speed (~100ms per test)
- Use test database
- May use mocked external services
- Coverage target (>70%)

**What to Test**:
- API endpoints (request/response)
- Database operations (CRUD)
- Service interactions
- Authentication flows
- Error handling and edge cases

**Example Structure**:
```
tests/
  integration/
    api/
      auth.test.ts
      robot.test.ts
    database/
      migrations.test.ts
```

**Best Practices**:
- Use test database (separate from dev)
- Clean database between tests
- Test happy path and error cases
- Validate status codes and response format
- Test authentication and authorization

---

### 3. End-to-End (E2E) Tests

**Scope**: Complete user workflows through the UI.

**Tools**:
- **Web**: Playwright or Cypress
- **Mobile**: Appium or Detox
- **API**: Postman collections

**Characteristics**:
- Slow execution (~1-5s per test)
- Run against full system
- Use production-like environment
- Coverage target (critical paths only)

**What to Test**:
- User registration and login
- Creating and managing robots
- Battle flow
- Payment processing (with test mode)
- Core user journeys

**Example Structure**:
```
tests/
  e2e/
    web/
      auth.spec.ts
      battle.spec.ts
    mobile/
      ios/
      android/
```

**Best Practices**:
- Focus on critical user paths
- Keep tests stable (avoid flaky tests)
- Use page object pattern
- Run in CI on every PR
- Record videos on failure

---

### 4. Performance Tests

**Scope**: System performance under load.

**Tools**:
- **k6**: Load testing
- **Apache JMeter**: Complex scenarios
- **Lighthouse**: Web performance
- **Artillery**: API load testing

**What to Test**:
- API response times under load
- Database query performance
- Concurrent user handling
- Memory leaks
- Resource utilization

**Metrics**:
- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Resource usage (CPU, memory)

**Load Test Scenarios**:
- Normal load: Expected daily traffic
- Peak load: 2x normal load
- Stress test: Find breaking point
- Soak test: Sustained load over time

**Performance Targets**:
- API response: <200ms (p95)
- Page load: <2s (p95)
- Concurrent users: 10,000+
- Database query: <50ms (p95)

---

### 5. Security Tests

**Scope**: Identify security vulnerabilities.

**Tools**:
- **SAST**: SonarQube, ESLint security plugin
- **DAST**: OWASP ZAP
- **Dependency**: Snyk, npm audit
- **Container**: Trivy, Clair

**What to Test**:
- SQL injection
- XSS vulnerabilities
- Authentication bypass
- Authorization flaws
- Sensitive data exposure
- Known vulnerabilities in dependencies

**Test Frequency**:
- SAST: Every commit
- Dependency scan: Daily
- DAST: Weekly
- Penetration test: Annually

---

## Test Data Management

### Test Database
- Separate database for testing
- Automated setup and teardown
- Seed data for consistent tests
- Migrations run automatically

### Test Data Strategy
- **Minimal Data**: Only what's needed for the test
- **Realistic Data**: Representative of production
- **Anonymized Data**: No real user data in tests
- **Data Builders**: Factories for creating test objects

### Data Cleanup
- Clean database before/after each test
- Use transactions and rollback
- Automated cleanup scripts

---

## Continuous Integration (CI)

### CI Pipeline Stages

```
1. Commit
   ├─ Lint
   ├─ Type check
   └─ Unit tests

2. Pre-Merge
   ├─ Unit tests (all)
   ├─ Integration tests
   ├─ Security scan (SAST)
   └─ Build

3. Post-Merge (main branch)
   ├─ E2E tests
   ├─ Security scan (DAST)
   ├─ Performance tests
   └─ Deploy to staging

4. Scheduled (nightly)
   ├─ Full test suite
   ├─ Dependency audit
   ├─ Security scan
   └─ Performance benchmarks
```

### CI Configuration (GitHub Actions Example)

**On Every Commit**:
- Linting
- Type checking
- Unit tests
- Fast feedback (<5 minutes)

**On Pull Request**:
- All tests (unit + integration)
- Security scans
- Build verification
- Code coverage report
- Complete within 15 minutes

**On Merge to Main**:
- Full test suite
- E2E tests
- Deploy to staging
- Smoke tests on staging

**Scheduled (Daily)**:
- Dependency audit
- Security scan
- Performance benchmarks
- Test data refresh

---

## Code Coverage

### Coverage Targets
- **Overall**: >80%
- **Critical modules**: >90% (auth, battle, payment)
- **New code**: >85%
- **UI components**: >70%

### Coverage Tools
- Jest/Vitest coverage reports
- Codecov or Coveralls integration
- PR comments with coverage diff

### Coverage Reports
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

---

## Testing Best Practices

### General Principles
1. **Tests should be deterministic**: Same input = same output
2. **Tests should be independent**: Can run in any order
3. **Tests should be fast**: Quick feedback loop
4. **Tests should be maintainable**: Easy to update
5. **Tests should be readable**: Clear intent

### Naming Conventions
```
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', () => {});
    it('should reject user with invalid email', () => {});
    it('should hash password before saving', () => {});
  });
});
```

### Test Structure (AAA Pattern)
```typescript
test('robot should take damage when hit', () => {
  // Arrange
  const robot = createRobot({ health: 100 });
  const damage = 20;
  
  // Act
  robot.takeDamage(damage);
  
  // Assert
  expect(robot.health).toBe(80);
});
```

### Mocking Guidelines
- Mock external dependencies (APIs, databases)
- Don't mock what you're testing
- Prefer dependency injection for easier mocking
- Use spy functions to verify calls

---

## Test Environment Setup

### Development Environment
- Local test database
- Mocked external services
- Fast test execution
- Watch mode for TDD

### CI Environment
- Containerized services (Docker)
- Isolated test databases
- Parallel test execution
- Artifact storage (coverage reports)

### Staging Environment
- Production-like configuration
- Real external services (test mode)
- Full E2E test suite
- Performance monitoring

---

## Test Documentation

### Test Plan
- Test objectives
- Test scope
- Test schedule
- Roles and responsibilities

### Test Cases
- Test ID
- Description
- Preconditions
- Steps
- Expected result

### Test Reports
- Tests executed
- Pass/fail status
- Defects found
- Coverage metrics

---

## Mobile Testing Strategy

### iOS Testing
- XCTest for unit tests
- XCUITest for UI tests
- Simulator and real device testing

### Android Testing
- JUnit for unit tests
- Espresso for UI tests
- Emulator and real device testing

### Cross-Platform (React Native)
- Jest for unit tests
- Detox for E2E tests
- Test on both platforms

---

## Regression Testing

### Automated Regression Suite
- Run full test suite on every release
- Critical path tests on every PR
- Automated smoke tests after deployment

### Regression Test Selection
- All tests for affected modules
- Critical path tests always
- Performance tests for backend changes

---

## Test Metrics & KPIs

### Key Metrics
- **Code Coverage**: >80%
- **Test Pass Rate**: >98%
- **Test Execution Time**: <15 min (CI)
- **Flaky Test Rate**: <2%
- **Bug Escape Rate**: <5%

### Monitoring
- Dashboard with test metrics
- Trend analysis
- Alert on coverage drop
- Regular test health reviews

---

## Test Maintenance

### Regular Activities
- Remove obsolete tests
- Update tests for new features
- Fix flaky tests
- Refactor test code
- Update test data

### Test Debt
- Track and prioritize test gaps
- Address in sprint planning
- Aim for zero untested code in critical paths

---

## Future Testing Enhancements

- AI-based test generation
- Visual regression testing
- Chaos engineering
- Contract testing for microservices
- Mutation testing for test quality
- A/B testing framework