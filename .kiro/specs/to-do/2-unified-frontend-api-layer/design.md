# Design Document: Unified Frontend API Layer

## Overview

Introduce a typed API helper (`src/utils/api.ts`) and a frontend `ApiError` class (`src/utils/ApiError.ts`) that sit between the existing Axios `apiClient` and the 11 domain API modules. The helper provides generic `get<T>`, `post<T>`, `put<T>`, `delete<T>` methods that unwrap `response.data` and normalize errors into `ApiError` instances carrying the backend's structured error codes. Domain API modules are then refactored to use the helper, cutting boilerplate while preserving their interfaces and helper functions.

### Key Research Findings

- All 11 API files follow the same pattern: `const response = await apiClient.get(url); return response.data;`
- `tournamentApi.ts` passes an unused `_token` parameter to every function — the interceptor handles auth.
- `kothApi.ts` does manual response shape mapping that could be simplified but should be preserved (backend response shape differs from frontend interface).
- Helper functions (formatters, color mappers, icon getters) in `matchmakingApi.ts` and `financialApi.ts` are not API calls and should stay in place.
- The backend's new structured error response (from Spec 1) provides `{ error, code, details }` — the frontend needs a matching error class.

## Architecture

```
src/utils/
├── apiClient.ts          # Existing Axios instance (unchanged)
├── api.ts                # NEW: Typed API helper wrapping apiClient
├── ApiError.ts           # NEW: Frontend structured error class
├── robotApi.ts           # Refactored to use api.get<T>()
├── matchmakingApi.ts     # Refactored to use api.get<T>()
├── tournamentApi.ts      # Refactored, _token params removed
├── financialApi.ts       # Refactored to use api.get<T>() / api.post<T>()
├── kothApi.ts            # Refactored (keeps response mapping)
├── tagTeamApi.ts         # Refactored
├── userApi.ts            # Refactored
├── onboardingApi.ts      # Refactored
├── onboardingAnalytics.ts # Refactored
├── guideApi.ts           # Refactored
└── ... (helper-only files unchanged)
```

### Request Flow

```
Component
  → domain API function (e.g., fetchMyRobots)
    → api.get<Robot[]>('/api/robots')
      → apiClient.get('/api/robots')  [JWT interceptor, auth handling]
        → Backend
      ← AxiosResponse
    ← response.data (typed as Robot[])
  ← Robot[]

Error Flow:
      ← AxiosError (response.data = { error, code, details })
    ← throws ApiError({ message, code, statusCode, details })
  ← catch(err) { if (err instanceof ApiError) { switch(err.code) { ... } } }
```

## Components and Interfaces

### ApiError Class (`src/utils/ApiError.ts`)

```typescript
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
```

### API Helper (`src/utils/api.ts`)

```typescript
import apiClient from './apiClient';
import { ApiError } from './ApiError';
import { isAxiosError } from 'axios';

function handleError(err: unknown): never {
  if (isAxiosError(err) && err.response) {
    const { data, status } = err.response;
    if (data && typeof data.code === 'string') {
      throw new ApiError(data.error || data.message || 'Request failed', data.code, status, data.details);
    }
    throw new ApiError(data?.error || 'Request failed', 'UNKNOWN_ERROR', status);
  }
  if (isAxiosError(err) && !err.response) {
    throw new ApiError('Network error', 'NETWORK_ERROR', 0);
  }
  throw new ApiError('Unknown error', 'UNKNOWN_ERROR', 0);
}

export const api = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await apiClient.get<T>(url, { params });
      return response.data;
    } catch (err) { handleError(err); }
  },
  async post<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await apiClient.post<T>(url, data);
      return response.data;
    } catch (err) { handleError(err); }
  },
  async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await apiClient.put<T>(url, data);
      return response.data;
    } catch (err) { handleError(err); }
  },
  async delete<T>(url: string): Promise<T> {
    try {
      const response = await apiClient.delete<T>(url);
      return response.data;
    } catch (err) { handleError(err); }
  },
};
```

### Refactored Domain API Example

Before (robotApi.ts):
```typescript
export const fetchMyRobots = async (): Promise<Robot[]> => {
  const response = await apiClient.get('/api/robots');
  return response.data;
};
```

After:
```typescript
export const fetchMyRobots = async (): Promise<Robot[]> => {
  return api.get<Robot[]>('/api/robots');
};
```

## Data Models

No data model changes. TypeScript interfaces remain in their respective domain API files.

## Correctness Properties

### Property 1: API helper preserves response data

For any successful API call, the data returned by `api.get<T>()` must be identical to `(await apiClient.get(url)).data`. The helper is a pure pass-through for successful responses.

### Property 2: All API errors are ApiError instances

For any failed API call made through the api helper, the thrown error must be an instance of `ApiError` with a non-empty `code` string and a numeric `statusCode`.

### Property 3: Domain API function signatures unchanged

For any domain API function that is refactored, the function's TypeScript signature (parameter types and return type) must remain identical to the pre-refactoring version. Components should not need import or call-site changes.

## Documentation Impact

The following existing documentation and steering files will need updating:

- `.kiro/steering/frontend-standards.md` — API Integration section currently shows raw `apiClient` usage. Must be updated to reference the `api` helper and `ApiError` class.
- `.kiro/steering/error-handling-logging.md` — Frontend Error Handling section currently shows `error.response?.status` pattern. Must be updated to reference `ApiError` and the `err.code` switch pattern.

## Testing Strategy

### Unit Tests
- Test `ApiError` class: constructor, properties, `instanceof` checks
- Test `api` helper: successful response unwrapping, structured error handling, network error handling, unknown error handling
- Mock `apiClient` to simulate various response and error scenarios

### Integration Tests
- Verify that refactored domain API functions return the same data as before
- Verify that error scenarios produce `ApiError` instances with correct codes

### Migration Verification
- After each domain API module is refactored, run the full frontend test suite
- Verify no component import changes are needed
