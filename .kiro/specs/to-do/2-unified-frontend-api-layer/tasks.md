# Implementation Plan: Unified Frontend API Layer

## Overview

Create a typed API helper and ApiError class, then refactor all 11 domain API modules to use them. Domain-specific interfaces and helper functions remain in their current files. The refactoring is mechanical — function signatures and return types don't change, so no component modifications are needed.

## Tasks

- [ ] 1. Create API infrastructure
  - [ ] 1.1 Create `src/utils/ApiError.ts` with the `ApiError` class (message, code, statusCode, details)
  - [ ] 1.2 Create `src/utils/api.ts` with typed `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.delete<T>()` methods that wrap `apiClient`, unwrap `response.data`, and normalize errors into `ApiError` instances
  - [ ] 1.3 Write unit tests for `ApiError` class and `api` helper (success path, structured error, network error, unknown error)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Refactor simple API modules (GET-only, no response mapping)
  - [ ] 2.1 Refactor `robotApi.ts` to use `api.get<T>()` — replace `apiClient.get()` + `.data` unwrapping
  - [ ] 2.2 Refactor `userApi.ts` to use `api.get<T>()` and `api.put<T>()`
  - [ ] 2.3 Refactor `guideApi.ts` to use `api.get<T>()`
  - [ ] 2.4 Refactor `onboardingAnalytics.ts` to use `api.get<T>()` and `api.post<T>()`
  - [ ] 2.5 Run frontend test suite to verify no regressions
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 3. Refactor API modules with parameters and response mapping
  - [ ] 3.1 Refactor `matchmakingApi.ts` to use `api.get<T>()` — preserve helper functions (`getLeagueTierName`, `getLeagueTierColor`, `getBattleOutcome`, etc.) unchanged
  - [ ] 3.2 Refactor `financialApi.ts` to use `api.get<T>()` and `api.post<T>()` — preserve helper functions (`formatCurrency`, `getHealthColor`, `getHealthIcon`) unchanged
  - [ ] 3.3 Refactor `tournamentApi.ts` to use `api.get<T>()` and `api.post<T>()` — remove unused `_token` parameters from all functions
  - [ ] 3.4 Refactor `tagTeamApi.ts` to use `api.get<T>()` and `api.post<T>()`
  - [ ] 3.5 Run frontend test suite to verify no regressions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2_

- [ ] 4. Refactor API modules with custom response mapping
  - [ ] 4.1 Refactor `kothApi.ts` to use `api.get<T>()` — preserve the response shape mapping logic in `getKothStandings()` (backend shape differs from frontend interface)
  - [ ] 4.2 Refactor `onboardingApi.ts` to use `api.get<T>()`, `api.post<T>()`, `api.put<T>()`
  - [ ] 4.3 Run frontend test suite to verify no regressions
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 5. Final verification and documentation
  - [ ] 5.1 Run full frontend test suite and verify all tests pass
  - [ ] 5.2 Verify that no component files needed import or call-site changes
  - [ ] 5.3 Verify total line count reduction across API files
  - [ ] 5.4 Update `.kiro/steering/frontend-standards.md` API Integration section to reference the `api` helper and `ApiError` class as the standard pattern for all API calls
  - [ ] 5.5 Update `.kiro/steering/error-handling-logging.md` Frontend Error Handling section to reference `ApiError` and the `err.code` switch pattern
  - [ ] 5.6 Run verification criteria checks: confirm zero direct `apiClient` usage in domain API files, zero `response.data` unwrapping, zero `_token` parameters
  - _Requirements: 3.4, 3.5_

## Notes

- Each task group can be committed independently
- Function signatures don't change, so components are unaffected
- The `kothApi.ts` response mapping is intentional (backend/frontend shape mismatch) and must be preserved
- Helper functions (formatters, color mappers, icon getters) stay in their current files — they're not API calls
