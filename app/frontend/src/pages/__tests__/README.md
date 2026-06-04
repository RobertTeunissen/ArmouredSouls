# League Standings Page Test Suite

This directory contains comprehensive tests for the League Standings Page feature.

## Test Structure

```
LeagueStandingsPage/
├── README.md                  # This file
├── setup.ts                   # Test setup and teardown
├── testUtils.ts              # Mock data factories and render helpers
├── apiMocks.ts               # API mocking utilities
├── helpers.test.ts           # Unit tests for helper functions
├── component.test.tsx        # Component rendering and interaction tests
├── integration.test.tsx      # API integration and data flow tests
└── accessibility.test.tsx    # Accessibility compliance tests
```

## Test Utilities

### Mock Data Factories

- `createMockRobot(overrides?)` - Create a single mock robot
- `createMockRobots(count, baseOverrides?)` - Create multiple mock robots
- `createMockInstance(overrides?)` - Create a single mock league instance
- `createMockInstances(tier, count)` - Create multiple mock instances
- `createMockPaginatedResponse(data, page?, pageSize?)` - Create paginated API response

### Render Helpers

- `renderWithAuthContext(ui, contextValue?)` - Render component with mocked AuthContext

### API Mocks

- `mockGetLeagueStandings` - Mock for getLeagueStandings API call
- `mockGetLeagueInstances` - Mock for getLeagueInstances API call
- `mockFetch` - Mock for global fetch (user robots endpoint)
- `setupDefaultApiMocks()` - Setup default mock implementations
- `resetApiMocks()` - Reset all API mocks

## Usage Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import LeagueStandingsPage from '../../pages/LeagueStandingsPage';
import { renderWithAuthContext, createMockRobots, createMockPaginatedResponse } from './testUtils';
import { mockGetLeagueStandings, mockGetLeagueInstances } from './apiMocks';
import './setup';

describe('LeagueStandingsPage', () => {
  beforeEach(() => {
    const mockRobots = createMockRobots(5);
    mockGetLeagueStandings.mockResolvedValue(
      createMockPaginatedResponse(mockRobots)
    );
  });

  it('should render standings table', async () => {
    renderWithAuthContext(<LeagueStandingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Robot1')).toBeInTheDocument();
    });
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- LeagueStandingsPage/helpers.test.ts
```

## Coverage Goals

- Line Coverage: ≥ 80%
- Branch Coverage: ≥ 80%
- Function Coverage: ≥ 80%

## Requirements Mapping

Each test file validates specific requirements from the requirements document:

- **helpers.test.ts**: Requirements 1.1-1.9, 2.1-2.3
- **component.test.tsx**: Requirements 3.1-3.5, 4.1-4.6, 5.1-5.5, 6.1-6.7, 7.1-7.6, 14.1-14.3
- **integration.test.tsx**: Requirements 8.1-8.3, 9.1-9.3, 10.1-10.3, 11.1-11.6
- **accessibility.test.tsx**: Requirements 13.1-13.4
