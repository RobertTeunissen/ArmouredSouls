# Requirements Document

## Introduction

Replace the 11 fragmented frontend API client files with a unified, typed API layer built on top of the existing `apiClient.ts` Axios instance. Each file currently duplicates the same pattern: import `apiClient`, define interfaces, wrap `apiClient.get()`/`.post()` with manual `.data` unwrapping. A shared abstraction eliminates this boilerplate, normalizes error handling to consume the backend's structured error codes (from Spec 1), and provides a single place to add cross-cutting concerns like retry logic or request deduplication.

## Glossary

- **ApiClient**: The existing Axios instance in `src/utils/apiClient.ts` with JWT interceptors and auth failure handling.
- **Api_Helper**: The new typed wrapper around ApiClient that provides generic `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()` methods, unwraps response data, and normalizes errors.
- **ApiError**: A frontend error class that mirrors the backend's `Structured_Error_Response` shape (`error`, `code`, `details`), enabling frontend consumers to switch on machine-readable error codes.
- **Domain_Api_Module**: A file that groups related API endpoints and their TypeScript interfaces for a specific domain (e.g., `robotApi.ts`, `financialApi.ts`). These files remain but are refactored to use the Api_Helper.

## Expected Contribution

This spec targets the "API client fragmentation" debt identified in the project assessment. The expected measurable outcomes after all tasks are complete:

1. **Boilerplate reduction**: Every API function body is reduced from 3 lines (`const response = await apiClient.get(url); return response.data;`) to 1 line (`return api.get<T>(url);`). Estimated ~30% line count reduction across the 11 API files.
2. **Consistent error handling**: 100% of API errors thrown to components are `ApiError` instances with machine-readable `code` fields. Before: raw `AxiosError` objects with inconsistent shapes.
3. **Dead code removal**: The unused `_token` parameter pattern in `tournamentApi.ts` (5 functions) is eliminated.
4. **Single error normalization point**: Error-to-`ApiError` conversion happens in one place (`api.ts`). Before: no error normalization, each component handles raw Axios errors differently.
5. **Zero component breakage**: All existing component imports and call sites work without changes.

### Verification Criteria

After all tasks are marked complete, run these checks to confirm the debt reduction was achieved:

1. `grep -r "apiClient\." src/utils/ | grep -v "apiClient.ts\|api.ts"` returns zero matches (no domain API file directly uses `apiClient`)
2. `grep -r "response\.data" src/utils/*Api.ts src/utils/onboardingApi.ts src/utils/onboardingAnalytics.ts src/utils/guideApi.ts` returns zero matches (no manual `.data` unwrapping)
3. `grep -r "_token" src/utils/tournamentApi.ts` returns zero matches
4. All frontend tests pass
5. No component files were modified (only `src/utils/` files changed)

## Requirements

### Requirement 1: Typed API Helper

**User Story:** As a frontend developer, I want a generic typed API helper that wraps Axios calls and returns unwrapped, typed response data, so that every API function doesn't need to manually access `.data` on the response.

#### Acceptance Criteria

1. WHEN a new `src/utils/api.ts` module is created, IT SHALL export typed helper functions `api.get<T>(url, params?)`, `api.post<T>(url, data?)`, `api.put<T>(url, data?)`, `api.delete<T>(url)` that return `Promise<T>` (unwrapped from `AxiosResponse.data`).
2. WHEN the Api_Helper makes a request, IT SHALL use the existing `apiClient` Axios instance (preserving JWT interceptors, auth failure handling, and base URL configuration).
3. WHEN the Api_Helper receives a successful response, IT SHALL return `response.data` directly, typed as `T`.
4. WHEN the Api_Helper receives an error response, IT SHALL throw an `ApiError` instance containing the backend's `error`, `code`, and `details` fields if the response body matches the structured error shape, or a generic `ApiError` with code `NETWORK_ERROR` or `UNKNOWN_ERROR` for non-structured failures.

### Requirement 2: Frontend ApiError Class

**User Story:** As a frontend developer, I want a structured `ApiError` class that carries the backend's machine-readable error code, so that UI components can switch on error codes to display context-appropriate messages and recovery actions.

#### Acceptance Criteria

1. WHEN a new `src/utils/ApiError.ts` is created, IT SHALL export an `ApiError` class with properties: `message` (string), `code` (string), `statusCode` (number), and `details` (unknown, optional).
2. WHEN an API call fails with a response that contains `{ error, code }` in the body, THE Api_Helper SHALL construct an `ApiError` with those values.
3. WHEN an API call fails with a network error (no response), THE Api_Helper SHALL construct an `ApiError` with code `NETWORK_ERROR` and statusCode `0`.
4. WHEN an API call fails with a response that does not match the structured error shape, THE Api_Helper SHALL construct an `ApiError` with code `UNKNOWN_ERROR` and the HTTP status code from the response.

### Requirement 3: Domain API Module Refactoring

**User Story:** As a frontend developer, I want the existing domain API modules to use the Api_Helper instead of raw Axios calls, so that response unwrapping and error normalization happen automatically without per-function boilerplate.

#### Acceptance Criteria

1. WHEN domain API modules are refactored, EACH function that currently calls `apiClient.get()` and returns `response.data` SHALL be replaced with a call to `api.get<T>()` that returns the typed data directly.
2. WHEN domain API modules are refactored, THE TypeScript interfaces defined in each module SHALL remain in their respective files (interfaces are not moved to a central location).
3. WHEN domain API modules are refactored, THE unused `_token` parameter pattern (present in `tournamentApi.ts`) SHALL be removed since the ApiClient interceptor handles auth automatically.
4. WHEN all domain API modules are refactored, THE total line count across API files SHALL be reduced by removing duplicated `.data` unwrapping and manual error handling.
5. WHEN domain API modules are refactored, ALL existing component imports from these modules SHALL continue to work without changes (function signatures and return types remain the same).

### Requirement 4: Helper Utility Preservation

**User Story:** As a frontend developer, I want domain-specific helper functions (formatters, color mappers, icon getters) to remain in their current files, so that the refactoring doesn't break component imports or move unrelated logic.

#### Acceptance Criteria

1. WHEN domain API modules are refactored, HELPER functions that do not make API calls (e.g., `getLeagueTierName`, `formatCurrency`, `getHealthColor`, `getBattleOutcome`) SHALL remain in their current files unchanged.
2. WHEN the refactoring is complete, NO component that imports a helper function from a domain API module SHALL need to change its import path.
