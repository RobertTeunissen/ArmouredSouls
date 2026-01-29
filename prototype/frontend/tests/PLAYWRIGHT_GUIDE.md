# Playwright E2E Testing Guide

> **Last Updated**: January 29, 2026

## Overview

This guide covers Playwright end-to-end (E2E) testing for the Armoured Souls frontend. For the complete testing strategy, see [/docs/TESTING_STRATEGY.md](../../docs/TESTING_STRATEGY.md).

## Quick Start

```bash
# Install dependencies (if not already done)
cd prototype/frontend
npm install

# Run E2E tests
npm run test:e2e

# Run tests with UI mode (recommended for development)
npm run test:e2e:ui

# Run tests in headed mode (see the browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# View test report
npm run playwright:report
```

## Test Organization

Tests are located in `/prototype/frontend/tests/e2e/` and follow this structure:

```
tests/e2e/
├── login.spec.ts           # Login page tests
├── dashboard.spec.ts       # Dashboard page tests
├── robot-creation.spec.ts  # Robot creation tests
└── ...                     # Additional page tests
```

For the overall testing pyramid and philosophy, refer to [/docs/TESTING_STRATEGY.md](../../docs/TESTING_STRATEGY.md#testing-pyramid).

## Screenshots

All tests automatically capture screenshots at key points:

- **Location**: `prototype/frontend/test-results/screenshots/`
- **Format**: PNG files with descriptive names
- **When**: Captured during test execution for visual verification

Screenshots are captured for:
- Initial page load states
- User interactions (before/after)
- Error states
- Success states
- Different viewport sizes (mobile, tablet, desktop)

### Reviewing Screenshots

After running tests, review screenshots in:
```
prototype/frontend/test-results/screenshots/
```

Screenshots help verify:
- UI renders correctly
- Responsive design works across devices
- Visual regressions haven't occurred
- Error messages display properly

## Configuration

Playwright configuration is in `/prototype/frontend/playwright.config.ts`. Key settings:

- **Base URL**: `http://localhost:3000` (frontend dev server)
- **Browser**: Chromium (can be extended to Firefox, WebKit)
- **Screenshots**: Captured on all test steps
- **Video**: Recorded only on failure
- **Trace**: Captured on retry for debugging

## Test Requirements

### Prerequisites

Before running E2E tests, ensure:

1. **Backend is running**: Tests require the API at `http://localhost:3001`
   - See [/docs/SETUP.md](../../docs/SETUP.md) for backend setup
   
2. **Database is seeded**: Tests use test accounts (e.g., `player1/password123`)
   - Run `npx tsx prisma/seed.ts` in `/prototype/backend/`

3. **Frontend dev server**: Auto-started by Playwright, or run manually with `npm run dev`

## Writing New Tests

When adding GUI changes, create corresponding E2E tests:

### 1. Create Test File

```typescript
// tests/e2e/new-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('New Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login or navigate to starting point
    await page.goto('/new-feature');
  });

  test('should display new feature correctly', async ({ page }) => {
    // Test logic here
    
    // ALWAYS capture screenshot
    await page.screenshot({ 
      path: 'test-results/screenshots/new-feature-state.png',
      fullPage: true 
    });
  });
});
```

### 2. Follow Best Practices

- **Use role-based selectors**: `page.getByRole('button', { name: 'Submit' })`
- **Capture screenshots**: At least one per test scenario
- **Test responsiveness**: Include mobile/tablet viewport tests
- **Handle async**: Use `await` and proper waits
- **Descriptive names**: Clear test and screenshot names

For detailed testing guidelines, see:
- [/docs/TESTING_STRATEGY.md#end-to-end-e2e-tests](../../docs/TESTING_STRATEGY.md)
- [/.github/copilot-instructions.md#testing-requirements](../../.github/copilot-instructions.md)

## CI/CD Integration

E2E tests run automatically on:
- Every pull request
- Merges to main branch

For CI/CD setup details, see [/docs/TESTING_STRATEGY.md#continuous-integration](../../docs/TESTING_STRATEGY.md).

## Common Issues

### Port Already in Use

If dev server fails to start:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Tests Timing Out

If tests timeout waiting for server:
- Check backend is running on port 3001
- Verify database is accessible
- Increase timeout in `playwright.config.ts`

### Screenshots Not Generated

- Ensure `test-results/screenshots/` directory exists
- Check write permissions
- Verify screenshot path in test code

## Additional Resources

- **Project Setup**: [/docs/SETUP.md](../../docs/SETUP.md)
- **Testing Strategy**: [/docs/TESTING_STRATEGY.md](../../docs/TESTING_STRATEGY.md)
- **Architecture**: [/docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- **Contributing**: [/CONTRIBUTING.md](../../CONTRIBUTING.md)
- **Copilot Instructions**: [/.github/copilot-instructions.md](../../.github/copilot-instructions.md)

## Playwright Documentation

For more on Playwright features:
- [Playwright Official Docs](https://playwright.dev)
- [Test Generator](https://playwright.dev/docs/codegen)
- [Debugging Guide](https://playwright.dev/docs/debug)
