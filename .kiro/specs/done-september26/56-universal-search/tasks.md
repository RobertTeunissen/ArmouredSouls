# Implementation Plan: Universal Search

## Overview

Implement the approved `Universal_Search_System` in TypeScript, React, Prisma, and PostgreSQL without expanding the MVP beyond robots, stables, and guide articles. The implementation must preserve existing destination authorization, use one authenticated `GET /api/search` request, compose one shared `Player_Shell` around all post-onboarding player routes, keep `Recent_Search_History` browser-local, and isolate admin-only search analytics from player responses.

All tasks are mandatory. The existing `requirements.md`, `design.md`, and `.config.kiro` are source artifacts and must not be modified. The implementation must preserve exact code artefact casing and the established `Pascal_Snake` domain concepts.

Execution rule: Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [x] 1. Implement the authenticated backend MVP search contract _Requirements: 1.1–1.11; 2.1–2.12; 3.1–3.15; 4.1–4.15_
  - [x] 1.1 Define shared backend search types, constants, and strict request validation.
    - Create `app/backend/src/services/search/searchTypes.ts` with the discriminated `Search_Result` union, `Search_Response`, source types, `Match_Rank`, category order, and the approved DTO fields.
    - Create `app/backend/src/schemas/search.ts` with a strict schema accepting only `q`, trimming leading/trailing whitespace, enforcing the `MAXIMUM_QUERY_LENGTH` and input-shape boundaries, rejecting repeated/non-string/missing/unknown query values, and using field-specific player-safe validation messages. Leave valid short normalized queries to the service/client short-query branch, which returns empty groups without source queries or analytics.
    - Keep request identity separate from query input; do not accept owner, account, visibility, or arbitrary route fields.
    - _Requirements: 1.1–1.2, 1.8–1.11, 4.1–4.5, 4.8–4.9_
  - [x] 1.2 Implement pure normalization, match classification, guide max-rank selection, deterministic sorting, and per-category limiting in `app/backend/src/services/search/searchRanking.ts`.
    - Preserve internal whitespace and non-whitespace characters while comparing case-insensitively.
    - Implement Exact_Match, Prefix_Match, and Substring_Match ordering with the documented robot, stable, and guide tie-breakers.
    - Require a case-insensitive substring relationship and implement no fuzzy, phonetic, edit-distance, or approximate branch.
    - Apply the category limit after rank and tie-break ordering; do not introduce a response-wide cross-category rank.
    - _Requirements: 2.1–2.12, 4.7_
  - [x] 1.3 Implement allow-listed result shaping and approved route identity fields in `app/backend/src/services/search/searchReferenceBuilder.ts`.
    - Shape robot results from robot identity/name and an optional trimmed non-empty stable subtitle only.
    - Shape stable results from user identity and trimmed stable name only, including generated/test stables when eligible and excluding `username` and `profileVisibility` filtering.
    - Shape guide results from title, section context, `sectionSlug`, and `articleSlug`, never article body content.
    - Ensure no private fields, credentials, arbitrary payloads, unrelated-account data, or server-provided arbitrary route strings can reach `Search_Response`.
    - _Requirements: 1.3–1.7, 3.1–3.15, 8.8_
  - [x] 1.4 Implement `app/backend/src/services/search/searchService.ts`.
    - Query robots only by `Robot.name`, users only by trimmed non-empty `User.stableName`, and guide articles only through `GuideService.getSearchIndex()`.
    - Use Prisma `select`/parameterized access for the approved source fields, return exactly `robots`, `stables`, and `guide` groups in fixed order, and return three empty groups before source access for short valid queries.
    - Rank and limit each category independently to 10, enforce the total limit of 30, and return only safe references.
    - Resolve the authenticated player identity from request context, not query input, and propagate source failures to the existing player-safe error boundary.
    - _Requirements: 1.1–1.11, 2.3–2.12, 3.1–3.15, 4.6–4.9, 4.12–4.14_
  - [x] 1.5 Add `app/backend/src/routes/search.ts` and wire the route in `app/backend/src/index.ts`.
    - Expose one authenticated `GET /api/search`, apply `validateRequest` with the strict search schema, call `searchService.search()`, and return the fixed grouped response.
    - Add `/api/search` to the existing authenticated per-user limiter prefix list while retaining the general `/api` limiter and existing player-safe 429 behavior; do not create a second search policy.
    - Keep the route thin with no inline Prisma queries or route-local helper functions.
    - _Requirements: 1.1–1.2, 1.8–1.11, 4.1–4.4, 4.8–4.14_
  - [x] 1.6 Redact search query data from ordinary diagnostics and error paths.
    - Update `app/backend/src/utils/safeRequestPath.ts`, `app/backend/src/middleware/requestLogger.ts`, `app/backend/src/middleware/schemaValidator.ts`, and `app/backend/src/middleware/errorHandler.ts` so request paths, validation diagnostics, rate-limit diagnostics, and dependency errors use a query-free safe path for `/api/search`.
    - Ensure player responses never contain raw query text, SQL, stack traces, filesystem paths, account identifiers, tokens, or full result payloads, and internal safe diagnostics never log the phrase or complete response.
    - _Requirements: 4.10–4.12, 4.15_
  - [x] 1.7 Add backend API contract tests for source scope, response shape, parameterized query behavior, safe errors, and category/total bounds once the pure test fixtures are available.
    - Keep these tests separate from the PostgreSQL/supertest integration file and make assertions on forbidden fields and forbidden categories explicit.
    - _Requirements: 1.3–1.7, 2.5, 2.8–2.12, 3.14–3.15, 4.6–4.7, 4.12–4.15_

- [x] 1.8 Checkpoint A — Ensure the backend search foundation has been type-checked and its focused unit tests are ready before beginning frontend composition; ask the user if questions arise.

- [x] 2. Compose the shared post-onboarding Player_Shell and Search_Palette
  - [x] 2.1 Create `app/frontend/src/components/layout/PlayerShell.tsx` and restructure `app/frontend/src/App.tsx` so all `Post_Onboarding_Player_Route` content is inside one protected shell.
    - Render exactly one `Navigation`, exactly one `SearchPalette`, and the route `Outlet` inside the shell.
    - Place Suspense/loading content, route error content, and not-found content inside the shell so the Global_Header and palette remain mounted.
    - Keep `/onboarding`, login/register/front-page routes, `/`, `/admin`, and all admin descendants outside the Player_Shell.
    - Remove shell-managed page-by-page `Navigation` composition without changing destination authorization or existing page behavior.
    - _Requirements: 5.1, 5.12, 7.6–7.8, 7.12–7.13, 11.1–11.6_
  - [x] 2.2 Update `app/frontend/src/components/Navigation.tsx` to receive an `onOpenSearch` callback and render the Search_Control in both existing header variants.
    - Render a visibly labelled desktop `Search` control with a visible `⌘ K` or `Ctrl K` hint in the fixed top navbar.
    - Render a visible search icon/button in the fixed mobile top header, not bottom navigation or the `More` drawer.
    - Keep Search_Palette rendering in `PlayerShell.tsx`, not in `Navigation.tsx`, to preserve one palette mount.
    - _Requirements: 5.1–5.8, 11.1, 11.6_
  - [x] 2.3 Create `app/frontend/src/components/search/SearchTrigger.tsx`.
    - Provide pointer/touch/keyboard activation, a visible focus indicator, an accessible name, and a minimum 44px by 44px activation region for desktop and mobile controls.
    - Open the palette without changing the current route and preserve the opening control for focus restoration.
    - _Requirements: 5.2–5.8, 5.12, 7.6, 7.13–7.16_
  - [x] 2.4 Create `app/frontend/src/components/search/SearchPalette.tsx`.
    - Implement a search-only dialog with an accessible name, dialog semantics, visible `Search robots, stables, or guide articles` scope text, and no command/page/navigation actions.
    - Render loading, results, recent-history, too-short, empty, and error states, including retry while preserving the current normalized query.
    - Close before route navigation, support Escape dismissal, and restore focus to the opening control when available.
    - Use a bounded desktop overlay at widths at or above 1024px and a vertically ordered, internally scrollable mobile sheet from 320px through 1023px with no horizontal overflow.
    - _Requirements: 5.9–5.20, 7.1–7.8, 7.12–7.17_
  - [x] 2.5 Create `app/frontend/src/components/search/SearchResultList.tsx`.
    - Render `robots`, `stables`, and `guide` groups in consistent order with readable category labels, accessible result names, visible focus, pointer activation, Arrow-key movement, Tab behavior, and Enter activation.
    - Ensure every result has a minimum 44px by 44px target and only exposes the approved result reference fields.
    - _Requirements: 5.16–5.18, 7.7–7.11, 7.14–7.17_
  - [x] 2.6 Implement `app/frontend/src/components/search/useSearchPalette.ts` for debounce, request generation, cancellation, focus lifecycle, and retry state.
    - Wait 200ms after the latest input change, avoid requests for normalized queries shorter than two characters, and use `AbortController` plus a generation guard so stale results/errors cannot replace the latest eligible response.
    - Keep focus inside the active dialog, support Tab/Shift+Tab and Arrow-key interaction, and preserve retry query state.
    - Call only the typed `app/frontend/src/utils/searchApi.ts` helper for MVP searches.
    - _Requirements: 5.6–5.18, 7.1–7.13_
  - [x] 2.7 Apply responsive and accessibility styling in the search components and the existing frontend styling conventions.
    - Verify the desktop overlay keeps the current page visible, the mobile sheet is vertically scrollable, all required controls are at least 44px, focus indicators are visible, and widths 320px, 375px, 768px, 1023px, 1024px, and 1920px have no horizontal overflow.
    - Follow the responsive tab/layout pattern from `.kiro/steering/frontend-standards.md` where applicable and ensure the Search_Control remains discoverable without the keyboard shortcut.
    - _Requirements: 5.2–5.9, 5.19–5.20, 7.14–7.17, 11.1–11.6_
  - _Requirements: 5.1–5.20; 7.1–7.17; 11.1–11.6_

- [x] 3. Implement typed client routes and browser-local Recent_Search_History
  - [x] 3.1 Create `app/frontend/src/utils/searchTypes.ts` and `app/frontend/src/utils/searchApi.ts`.
    - Define the frontend safe DTO union without full entity data or analytics fields.
    - Implement one typed `GET /api/search` request with `q` and an `AbortSignal`; do not add a second guide/entity search endpoint and do not send history, account identity, or selection data.
    - _Requirements: 1.1–1.2, 3.14–3.15, 4.13–4.15, 5.13–5.16, 6.10–6.11_
  - [x] 3.2 Create pure history functions and the guarded local-storage adapter in `app/frontend/src/utils/searchHistory.ts`.
    - Use `armoured-souls:recent-searches`, normalize and discard invalid values, remove case-insensitive duplicates, retain at most five values newest-first, and safely handle malformed JSON and unavailable storage.
    - Implement clear behavior without sending any history mutation to the backend.
    - _Requirements: 6.1–6.14_
  - [x] 3.3 Create `app/frontend/src/utils/searchRoutes.ts`.
    - Validate result identity fields and construct only `/robots/:id`, `/stables/:userId`, or `/guide/:sectionSlug/:articleSlug`.
    - Reject non-positive/invalid IDs and unsafe slugs; never use raw Search_Query, label, username, arbitrary route strings, or client-supplied account context.
    - Allow existing destination not-found/access behavior to render without adding search metadata.
    - _Requirements: 3.2–3.3, 3.8, 3.13, 8.1–8.8_
  - [x] 3.4 Integrate `SearchHistoryList.tsx`, history selection, submission/result-selection insertion, and clear-history behavior with `SearchPalette.tsx` and `useSearchPalette.ts`.
    - Selecting history populates the input and follows the normal short-query/debounce behavior; submitting/selecting a result stores the normalized query once and selection closes before navigation.
    - Render the Clear_History_Control only when history exists, provide accessible labels and a 44px target, and show empty-history state after clearing.
    - _Requirements: 5.10, 5.17–5.18, 6.1–6.14, 7.14–7.16, 8.1–8.7_
  - _Requirements: 6.1–6.14; 8.1–8.8_

- [x] 4. Add the dedicated Search_Analytics_Store and active-season lifecycle
  - [x] 4.1 Add `SearchAnalyticsEvent` and the `User.searchAnalyticsEvents` relation to `app/backend/prisma/schema.prisma`.
    - Include `seasonNumber`, `cycleNumber`, `userId`, server timestamp, `normalizedPhrase`, three category counts, total count, and `noResult` with the exact mapped column names and active-season/reporting indexes from the design.
    - Keep this model separate from `audit_logs`, `AdminAuditLog`, browser storage, and `Search_Response`; use the intended user deletion behavior.
    - _Requirements: 12.1, 12.7, 12.9–12.13, 12.19–12.20_
  - [x] 4.2 Generate and review the Prisma migration at `app/backend/prisma/migrations/<generated-search-analytics-migration>/migration.sql`.
    - Create `search_analytics_events`, its foreign key, mapped columns, and all required indexes through the normal Prisma migration workflow.
    - Regenerate the project-local Prisma client if required by the schema change; do not edit generated client output by hand.
    - _Requirements: 12.1, 12.7, 12.9–12.10, 12.19–12.20_
  - [x] 4.3 Create `app/backend/src/services/search/searchAnalyticsTypes.ts` and `app/backend/src/services/search/searchAnalyticsStore.ts`.
    - Define typed event/reporting inputs and a dedicated persistence interface that writes only completed Search_Analytics_Event values.
    - Capture server-owned identity/context/timestamp and exact normalized phrase/count fields; expose no raw event rows or player-facing analytics fields.
    - _Requirements: 12.1, 12.7, 12.9–12.12, 12.19_
  - [x] 4.4 Implement `app/backend/src/services/search/searchAnalyticsService.ts` and integrate it after successful grouped search completion.
    - Make exactly one Search_Analytics_Store write attempt for each eligible authenticated completed search, including zero-result responses; a successful persistence creates exactly one Search_Analytics_Event row, while a persistence failure creates no row, performs no retry or duplicate attempt, preserves the unchanged Search_Response, and exposes a typed incomplete-telemetry limitation. Make no write attempt and create no event row for short, malformed, over-length, unauthenticated, rate-limited, or failed searches.
    - Keep analytics response-isolated: a Search_Persistence_Failure emits only safe internal diagnostics without the phrase and does not fail player search.
    - Do not record keystrokes, Recent_Search_History operations, result selections, selected categories, or browser activity.
    - _Requirements: 12.1–12.13_
  - [x] 4.5 Add `search_analytics_events` to the fixed active-season purge set in `app/backend/src/services/season/seasonPurgeService.ts`.
    - Ensure `Season_Rollover` purges the current season’s events, reports the deletion through existing purge accounting, and creates no cross-season archive or fallback copy.
    - Preserve the existing rollover failure behavior so a failed required purge cannot be reported as a complete rollover.
    - _Requirements: 12.19–12.20_
  - [x] 4.6 Add safe internal telemetry diagnostics for Search_Persistence_Failure in the existing observability path.
    - Log only an operation code, safe event timestamp/context when available, authenticated user ID, and result counts; never log `Normalized_Search_Phrase`, the raw request URL, full response, token, or audit payload.
    - _Requirements: 4.15, 12.11–12.13_
  - _Requirements: 12.1–12.13; 12.19–12.20_

- [x] 5. Implement the admin-only Search_Analytics_Report resource and page _Requirements: 12.14–12.18; 12.21_
  - [x] 5.1 Implement `app/backend/src/services/search/searchAnalyticsReportService.ts` and extend `app/backend/src/routes/adminAnalytics.ts` with `GET /search-analytics/report`.
    - Add strict admin query validation for bounded cycle filters, page, and limit; resolve the active season server-side and reject historical-season access because no cross-season archive exists.
    - Aggregate totals, unique searchers, cycle trends, top phrases, no-result phrases, category usage, and bounded per-player/stable analysis with deterministic pagination and safe joins.
    - Use `authenticateToken` and `requireAdmin`, preserve the existing admin authorization failure, and never expose raw event IDs/payloads, passwords, tokens, or unbounded event rows.
    - _Requirements: 12.14–12.20_
  - [x] 5.2 Create `app/frontend/src/utils/adminSearchAnalyticsApi.ts` with typed access to `GET /api/admin/search-analytics/report`.
    - Model the report envelope, period, overview, trend, phrase, category, pagination, and limitation fields without coupling it to player Search_Response DTOs.
    - Preserve active filters during retry and keep report failures player/admin safe.
    - _Requirements: 12.14–12.18_
  - [x] 5.3 Create `app/frontend/src/pages/admin/SearchAnalyticsPage.tsx`.
    - Render active-season/cycle filters, totals, unique users, no-result totals, trends, top/no-result phrases, category usage, safe paginated player/stable analysis, loading/error/retry states, and typed limitations.
    - Keep the page under the existing admin portal and out of Player_Shell and the player Search_Palette.
    - _Requirements: 12.14–12.18_
  - [x] 5.4 Update `app/frontend/src/components/admin/AdminLayout.tsx` and the admin route configuration in `app/frontend/src/App.tsx`.
    - Add `/admin/search-analytics` to the existing lazy-loaded admin page/title/sidebar mapping while retaining `AdminRoute` authorization and the existing admin layout/error boundary.
    - Do not render the page or its API on player routes.
    - _Requirements: 12.14, 12.18_
  - [x] 5.5 Add mobile layout behavior to `SearchAnalyticsPage.tsx`.
    - At widths below 1024px, stack report sections, filters, tables, and pagination vertically; support 320px–1023px without horizontal overflow; keep filters, retry, pagination, and navigation controls at least 44px by 44px.
    - Follow `.kiro/steering/frontend-standards.md` responsive tab/layout conventions where applicable; leave the dedicated mobile assertions to `app/frontend/src/pages/admin/__tests__/SearchAnalyticsPage.mobile.test.tsx`.
    - _Requirements: 12.17–12.18, 12.21_

- [x] 5.6 Checkpoint B — Ensure the player shell, local history, analytics persistence, and admin report code are integrated enough for component and integration tests; ask the user if questions arise.

- [x] 6. Add backend unit and property-based tests with exclusive tier assignment
  - [x] 6.1 Create `app/backend/src/services/search/__tests__/searchRanking.test.ts` with example-based normalization, rank, guide max-rank, no-fuzzy, tie-break, independent ordering, and limit tests.
    - Cover exact/prefix/substring boundaries, internal whitespace, case variants, empty/short values, deterministic ID/slug ties, category limits, and total bound behavior.
    - _Requirements: 2.1–2.12, 9.1_
  - [x] 6.2 Add Property 1 to `app/backend/src/services/search/__tests__/searchRanking.property.test.ts`.
    - Use fast-check with at least 100 runs and the required comment `Feature: universal-search, Property 1: Normalization and case invariance`.
    - Verify only edge whitespace is removed, normalization is idempotent, case changes preserve classification/identity, and internal whitespace/non-whitespace characters remain meaningful.
    - _Validates: Design Property 1; Requirements 2.1, 2.2, 4.5, 9.1, 9.6_
  - [x] 6.3 Add Property 2 to `app/backend/src/services/search/__tests__/searchRanking.property.test.ts`.
    - Generate robot, stable, guide, username, team, weapon, navigation, and battle-history decoys and verify scope conservation plus no fuzzy matches.
    - Include generated/test stables and only Guide_Search_Index title/description/body as guide search inputs.
    - _Validates: Design Property 2; Requirements 1.3–1.7, 2.5, 2.12, 9.1, 9.6_
  - [x] 6.4 Add Property 3 to `app/backend/src/services/search/__tests__/searchRanking.property.test.ts`.
    - Verify Exact_Match precedes Prefix_Match and Prefix_Match precedes Substring_Match in every group, and guide rank is the maximum of title/description/body ranks.
    - _Validates: Design Property 3; Requirements 2.3, 2.4, 2.6, 9.1, 9.6_
  - [x] 6.5 Add Property 4 to `app/backend/src/services/search/__tests__/searchRanking.property.test.ts`.
    - Permute each generated source collection and assert identical ordered safe result references after deterministic category tie-breaking.
    - _Validates: Design Property 4; Requirement 2.7, 9.1, 9.6_
  - [x] 6.6 Add Property 5 to `app/backend/src/services/search/__tests__/searchRanking.property.test.ts`.
    - Generate oversized source collections and assert at most 10 values per group, at most 30 total, and top-N selection from each independently ranked category rather than response-wide ranking.
    - _Validates: Design Property 5; Requirements 2.8–2.11, 4.7, 9.1, 9.6_
  - [x] 6.7 Create `app/backend/src/services/search/__tests__/searchReferenceBuilder.test.ts`.
    - Add allow-list examples for robot/stable/guide results, empty subtitle omission, generated/test stable inclusion, route identity fields, invalid identity rejection, and forbidden private/body/username fields.
    - _Requirements: 3.1–3.15, 8.8, 9.1_
  - [x] 6.8 Add Property 6 to `app/backend/src/services/search/__tests__/searchReferenceBuilder.property.test.ts`.
    - Generate source objects containing arbitrary extra/private fields and assert the shaped result contains only approved discriminated fields and no article body, username, credential, or arbitrary route.
    - _Validates: Design Property 6; Requirements 3.1, 3.4–3.7, 3.11–3.15, 8.8, 9.1, 9.6_
  - [x] 6.9 Add Property 7 to `app/backend/src/services/search/__tests__/searchReferenceBuilder.property.test.ts`.
    - Generate null, empty, whitespace-only, and non-empty stable names plus varying `profileVisibility`/`isGenerated` values and assert eligibility is based only on trimmed stable name.
    - _Validates: Design Property 7; Requirements 1.4, 1.6, 3.9–3.10, 9.1, 9.6_
  - [x] 6.10 Create `app/backend/src/services/search/__tests__/searchService.test.ts`.
    - Mock Prisma and `GuideService.getSearchIndex()` to verify one grouped orchestration, fixed category order, short-query no-source behavior, safe dependency failure, source selectors, response isolation, and limits.
    - _Requirements: 1.1–1.11, 2.5–2.11, 4.6–4.14, 9.1_
  - [x] 6.11 Add Property 11 to `app/backend/src/services/search/__tests__/searchService.property.test.ts`.
    - Generate normalized queries shorter than two characters and assert no source or guide index call, no endpoint request in the mocked client boundary, and exactly three empty groups from the backend branch.
    - _Validates: Design Property 11; Requirements 1.9, 5.15, 9.1, 9.6_
  - [x] 6.12 Add Property 13 to `app/backend/src/services/search/__tests__/searchAnalytics.property.test.ts`.
    - Generate completed eligible responses and active contexts; assert event construction contains only server identity/context/timestamp, exact normalized phrase, three counts, total count, and no-result status, while preserving the original response and safe log/audit fixtures.
    - _Validates: Design Property 13; Requirements 12.1, 12.7, 12.9–12.13, 9.6, 9.7_
  - [x] 6.13 Add Property 14 to `app/backend/src/services/search/__tests__/searchAnalytics.property.test.ts`.
    - Generate eligible/ineligible request outcomes and assert exactly one Search_Analytics_Store write attempt for each valid authenticated completed search, including zero results; successful persistence creates exactly one Search_Analytics_Event row, while persistence failure creates no row, performs no retry or duplicate attempt, preserves the successful Search_Response, and exposes a typed incomplete-telemetry limitation; assert no write attempt or event row for short, malformed, over-length, unauthenticated, rate-limited, failed, keystroke, history, selection, or category operations.
    - _Validates: Design Property 14; Requirements 12.1–12.8, 9.6, 9.7_
  - [x] 6.14 Add Property 15 to `app/backend/src/services/search/__tests__/searchAnalytics.property.test.ts`.
    - Generate active-season events and cycle/page filters and assert report totals, unique users, trends, phrase summaries, no-result phrases, category usage, bounded deterministic pagination, and per-player/stable analysis.
    - _Validates: Design Property 15; Requirements 12.15–12.17, 9.6, 9.7_
  - [x] 6.15 Add Property 16 to `app/backend/src/services/search/__tests__/searchAnalytics.property.test.ts`.
    - Generate mixed-season events and admin identities and assert only authorized administrators receive active-season bounded reports; non-admins receive no report data and no cross-season event is reported.
    - _Validates: Design Property 16; Requirements 12.14, 12.18–12.19, 9.6, 9.7_
  - [x] 6.16 Create `app/backend/src/services/search/__tests__/searchAnalyticsStore.test.ts`.
    - Test exactly one Search_Analytics_Store write attempt for eligible completed searches, exactly one Search_Analytics_Event row on persistence success, no row and no retry or duplicate attempt on persistence failure, no `audit_logs` fallback, fail-open persistence handling, safe diagnostic fields, and unchanged Search_Response on persistence failure.
    - _Requirements: 12.1–12.13, 9.1, 9.6, 9.7_
  - [x] 6.17 Update `app/backend/jest.tiers.js` so every pure search unit/property test is assigned to exactly one backend test tier and no new test is uncollected or multiply collected.
    - Keep database/supertest tests out of the unit tier and preserve the blocking `test:tiers:verify` contract.
    - _Requirements: 9.1, 9.6, 9.9_
  - _Requirements: 9.1, 9.6–9.7; 12.1–12.13; 12.19–12.20_

- [x] 7. Add frontend unit, component, property, and route-layout tests
  - [x] 7.1 Create `app/frontend/src/components/search/__tests__/SearchPalette.test.tsx`.
    - Cover visible trigger/scope text, Cmd+K/Ctrl+K default prevention, focus on open, focus trap/restoration, Escape, arrows, Tab, Enter, grouped clickable results, close-before-navigation, loading, recent-history, too-short, empty, error, retry, and no command actions.
    - Assert the palette uses one `/api/search` path, does not send history, does not expose analytics, and renders approved route targets only.
    - _Requirements: 5.6–5.18, 7.1–7.16, 8.1–8.7, 9.3, 9.8_
  - [x] 7.2 Create `app/frontend/src/utils/__tests__/searchHistory.test.ts`.
    - Cover valid localStorage, malformed JSON, non-string entries, whitespace-only/over-length entries, case-insensitive duplicates, newest-first ordering, five-item bound, unavailable storage, clear behavior, and no network calls.
    - _Requirements: 6.1–6.14, 9.3, 9.8_
  - [x] 7.3 Add Property 9 to `app/frontend/src/utils/__tests__/searchHistory.property.test.ts`.
    - Use fast-check with at least 100 runs and the required comment `Feature: universal-search, Property 9: Recent history bound, uniqueness, order, and idempotence`.
    - Generate submitted/selected query sequences and assert normalized, case-insensitive unique, newest-first, five-item history plus empty output after clear.
    - _Validates: Design Property 9; Requirements 6.3–6.6, 9.3, 9.6_
  - [x] 7.4 Add Property 10 to `app/frontend/src/utils/__tests__/searchHistory.property.test.ts`.
    - Generate valid and malformed browser-local payloads and assert only normalized valid strings survive, duplicate positions collapse correctly, and no more than five values are returned.
    - _Validates: Design Property 10; Requirement 6.12, 9.3, 9.6_
  - [x] 7.5 Add Property 8 to `app/frontend/src/utils/__tests__/searchRoutes.property.test.ts`.
    - Use fast-check with at least 100 runs and assert valid discriminated references produce only the three approved routes while arbitrary query text, labels, usernames, unsafe slugs, and invalid IDs cannot become route segments.
    - _Validates: Design Property 8; Requirements 8.1–8.8, 9.3, 9.6_
  - [x] 7.6 Add Property 12 to `app/frontend/src/components/search/__tests__/SearchPalette.property.test.tsx`.
    - Use fake timers, generated debounced eligible queries, and out-of-order mocked responses to assert only the latest request generation can update the presented state.
    - Include the required comment `Feature: universal-search, Property 12: Latest-query presentation` and at least 100 runs.
    - _Validates: Design Property 12; Requirements 5.13–5.15, 7.1–7.2, 9.3, 9.6_
  - [x] 7.7 Create `app/frontend/src/components/__tests__/Navigation.search.test.tsx`.
    - Assert desktop labelled Search plus visible shortcut hint, mobile fixed-header search control, visible discovery independent of shortcut, absence from bottom navigation/More drawer, and minimum activation target.
    - _Requirements: 5.1–5.8, 7.14–7.16, 9.3–9.4_
  - [x] 7.8 Create `app/frontend/src/components/layout/__tests__/PlayerShell.test.tsx`.
    - Assert exactly one Player_Shell-owned `Navigation` and Search_Palette for every post-onboarding route content state (normal/loading/error/not-found), no page-by-page duplicate shell, and no shell-owned search UI on onboarding, auth/front-page, or admin routes.
    - _Requirements: 5.1, 7.6–7.8, 7.12–7.13, 9.4–9.5, 11.1–11.6_
  - [x] 7.9 Create `app/frontend/src/pages/admin/__tests__/SearchAnalyticsPage.test.tsx`.
    - Cover admin report loading/error/retry, active-season filters, totals, unique users, trends, phrases, category usage, limitations, bounded pagination, and safe display fields.
    - Assert the player shell/search palette is not required or rendered by the admin page.
    - _Requirements: 12.14–12.20, 9.7–9.8_
  - [x] 7.10 Create `app/frontend/src/pages/admin/__tests__/SearchAnalyticsPage.mobile.test.tsx`.
    - Assert stacked sections and controls below 1024px, no horizontal overflow across required widths, and 44px filter/retry/pagination/navigation targets.
    - _Requirements: 12.21, 9.4, 9.8_
  - _Requirements: 5.1–5.20; 6.1–6.14; 7.1–7.17; 8.1–8.8; 9.3–9.6, 9.8; 11.1–11.6; 12.14–12.21_

- [x] 8. Add PostgreSQL integration, admin integration, route-layout browser, and blocking-tier coverage _Requirements: 9.2, 9.4–9.9; 12.1–12.21_
  - [x] 8.1 Create `app/backend/src/routes/__tests__/search.integration.test.ts` in the database-dependent tier.
    - Use a listening server and PostgreSQL fixtures to cover authentication, one-request grouped results, all source scope boundaries, generated/test stable inclusion, null/cleared names, guide index results, destination-safe references, owner/non-owner behavior, strict malformed/unknown/repeated/non-string/short/over-length input, parameterized SQL-like input, and rate limiting.
    - Assert no source query, analytics store write attempt, or Search_Analytics_Event row for rejected or short inputs and safe request/error/rate-limit logs without raw query phrases.
    - _Requirements: 1.1–1.11, 2.8–2.12, 3.1–3.15, 4.1–4.15, 9.2, 9.7, 9.9_
  - [x] 8.2 Create `app/backend/src/routes/__tests__/adminSearchAnalytics.integration.test.ts` in the database-dependent tier.
    - Cover exactly one Search_Analytics_Store write attempt for each eligible completed authenticated search including zero results; successful persistence creates exactly one Search_Analytics_Event row; persistence failure creates no row, performs no retry or duplicate attempt, preserves the unchanged Search_Response, and exposes a typed incomplete-telemetry limitation; cover no write attempt or event row for every excluded outcome, server-captured fields, response equality before/after telemetry, Telemetry_Fail_Open, phrase non-leakage, admin authorization, report aggregates, bounded pagination, active-season-only filtering, and `Season_Rollover` deletion with no archive row.
    - _Requirements: 9.2, 9.7, 12.1–12.20_
  - [x] 8.3 Update `app/backend/jest.tiers.js` to assign `search.integration.test.ts` and `adminSearchAnalytics.integration.test.ts` exclusively to the Integration_Tier.
    - Verify no test file is collected by zero tiers or more than one tier.
    - _Requirements: 9.2, 9.6–9.7, 9.9_
  - [x] 8.4 Create `app/frontend/tests/e2e/universal-search.spec.ts`.
    - Cover authenticated desktop and mobile flows at 320px, 375px, 768px, 1023px, 1024px, and 1920px; Search_Control placement; visible scope text; shortcut and pointer/touch opening; focus trap/restoration; Escape/Arrow/Enter behavior; results/history/clear/retry; route navigation; destination not-found/access behavior; 44px targets; and no horizontal overflow.
    - Cover Player_Shell presence through loading/error/not-found states and exclusion of onboarding, login/register/front-page, and admin routes.
    - Cover admin-only Search_Analytics_Page authorization, active-season report, stacked mobile layout, pagination, phrase/category visibility only for admins, and absence of analytics on player surfaces.
    - _Requirements: 5.1–5.20, 6.1–6.14, 7.1–7.17, 8.1–8.8, 9.4, 9.8, 11.1–11.6, 12.14–12.21_
  - [x] 8.5 Add frontend network assertions to `universal-search.spec.ts` and the relevant component tests for response isolation.
    - Assert there is one player `/api/search` request path where the `q` transport value is allowed only at that endpoint and is redacted from request/error/rate-limit logs; no second guide request, no history payload, no selection/category/keystroke analytics request, unchanged Search_Response shape, no player access to admin analytics, and no raw or normalized phrase copied into navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads.
    - _Requirements: 4.13–4.15, 6.10–6.11, 9.8, 12.7–12.13_
  - [x] 8.6 Run `app/backend` `test:tiers:verify` after all test files are added and correct any zero-tier, duplicate-tier, or undocumented-exclusion result without weakening the check.
    - _Requirements: 9.6, 9.9_
  - [x] 8.7 Add integration assertions that a failed required `search_analytics_events` purge blocks a claimed-complete rollover under the existing error path and never creates a cross-season fallback/archive.
    - _Requirements: 12.19–12.20, 9.7, 9.9_

- [x] 8.8 Checkpoint C — Ensure all implementation, unit/property, integration, route-layout, and browser test code is wired before documentation and final verification; ask the user if questions arise.

- [x] 9. Create the required implementation and steering documentation
  - [x] 9.1 Create `docs/implementation_notes/UNIVERSAL_SEARCH_CONTRACT.md`.
    - Document the three MVP categories and searchable fields, `Normalized_Query`, ranking/tie-breaks, 10/30 limits, 200ms debounce, no-fuzzy boundary, safe DTO allow-lists, authentication/rate limiting, safe logging, approved routes, destination Access_Context preservation, Search_Analytics_Event fields, Telemetry_Fail_Open limitation, active-season retention/purge, admin report API, and deferred scope.
    - _Requirements: 10.1–10.6_
  - [x] 9.2 Create `docs/prd_pages/PRD_UNIVERSAL_SEARCH.md`.
    - Document Global_Header/Search_Control placement, visible shortcut hint, mobile fixed-header control, scope help text, Search_Palette states, shared shell loading/error/not-found availability, keyboard/focus/touch behavior, 44px targets, desktop overlay, 320px–1023px mobile sheet, no-overflow behavior, and destination Access_Context.
    - _Requirements: 10.1, 10.3–10.5_
  - [x] 9.3 Create `docs/guides/UNIVERSAL_SEARCH_GUIDE.md` and update `docs/guides/README.md`.
    - Explain Guide_Search_Index participation, source/DTO allow-list expansion, Search_Analytics_Store/reporting boundary, rate-limit and logging troubleshooting, active-season purge, required test commands/tier assignment, and explicitly deferred username/fuzzy/command/click/cross-season analytics behavior.
    - Add the guide to the guides index with the exact filename.
    - _Requirements: 10.1–10.6_
  - [x] 9.4 Update `docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md`.
    - Record Search_Palette overlay/sheet treatment, responsive breakpoint behavior, visible focus, restrained motion, 44px controls, readable category labels, and no-overflow mobile rules.
    - _Requirements: 10.4_
  - [x] 9.5 Update `.kiro/steering/frontend-standards.md`.
    - Document reusable Player_Shell/Search_Palette composition, the 1024px responsive breakpoint, mobile fixed-header Search_Control, focus trap/restoration, and 44px touch-target conventions used by this feature.
    - _Requirements: 10.3–10.4, 11.1–11.6_
  - [x] 9.6 Update `.kiro/steering/frontend-state-management.md`.
    - State that Player_Shell palette state and browser-local Recent_Search_History use local hook/component state and `localStorage`, not a Zustand store, and that history is never sent to the backend.
    - _Requirements: 6.10–6.11, 10.4_
  - [x] 9.7 Update `.kiro/steering/testing-strategy.md`.
    - Add exact backend unit/property/integration/tier files, frontend component/property/route-layout files, Playwright file, analytics retention/admin tests, mobile assertions, and the blocking no-`continue-on-error`/no-`|| true`/no-unguarded-pipe/ no-undocumented-exclusion rule for Universal_Search_System.
    - _Requirements: 9.1–9.9, 10.4_
  - [x] 9.8 Update `.kiro/steering/project-overview.md`.
    - Add Universal_Search_System, Player_Shell, Search_Analytics_Store, `GET /api/search`, `GET /api/admin/search-analytics/report`, the three-category boundary, active-season analytics retention, and admin-only reporting without claiming broader backlog scope.
    - _Requirements: 10.1–10.6, 11.1–11.6, 12.14–12.20_
  - [x] 9.9 Cross-check all new documentation against `requirements.md` and `design.md` for exact code artefact casing, established Pascal_Snake concepts, deferred scope, route boundaries, fail-open telemetry, and mobile requirements; do not update `docs/BACKLOG.md` in this group.
    - _Requirements: 10.1–10.6_
  - _Requirements: 10.1–10.6; 11.1–11.6; 12.14–12.20_

- [x] 10. Final verification gate and post-verification backlog update
  - [x] 10.1 Run Verification Criteria 1 and 2 from `requirements.md`.
    - Check the requirements/config files exist and run the specified repository search for `GET /api/search`, `Universal_Search_System`, `Minimum_Query_Length`, `Per_Category_Result_Limit`, `Recent_Search_History`, `Global_Header`, and `Player_Shell` across the named code/docs/spec paths.
    - _Requirements: 9.9, 10.1–10.6, 11.1–11.6_
  - [x] 10.2 Run Verification Criteria 3 and 4 from `requirements.md`.
    - Execute `cd app/backend && pnpm run test:unit -- search && pnpm run build && pnpm run typecheck:tests` and `cd app/backend && pnpm run test:integration -- search` without advisory bypasses.
    - _Requirements: 1.1–1.11, 2.1–2.12, 3.1–3.15, 4.1–4.15, 9.1–9.2, 9.9_
  - [x] 10.3 Run Verification Criterion 5 from `requirements.md`.
    - Execute `cd app/frontend && pnpm test -- --run search && pnpm run lint && pnpm run build` and correct failures in implementation or tests.
    - _Requirements: 5.1–5.20, 6.1–6.14, 7.1–7.17, 8.1–8.8, 9.3, 9.9_
  - [x] 10.4 Run Verification Criterion 6 from `requirements.md`.
    - Execute `cd app/frontend && pnpm exec playwright test tests/e2e/universal-search.spec.ts` and verify all required desktop/mobile widths, route-layout states, exclusions, shortcut behavior, scope text, navigation, focus, 44px targets, and no horizontal overflow.
    - _Requirements: 5.1–5.20, 7.6–7.17, 8.1–8.8, 9.4, 9.9, 11.1–11.6, 12.21_
  - [x] 10.5 Run Verification Criterion 7 from `requirements.md`.
    - Confirm all 16 property-based tests report their actual current result, backend route-layout tests report exactly one shell mount for eligible routes and none for excluded routes, and no property task is skipped or advisory.
    - _Requirements: 9.1–9.6, 9.9, 11.1–11.6, 12.1–12.21_
  - [x] 10.6 Run Verification Criteria 8 and 9 from `requirements.md`.
    - Run the specified analytics-boundary grep and targeted backend unit/integration search commands; verify that each eligible completed search makes exactly one Search_Analytics_Store write attempt, successful persistence creates exactly one Search_Analytics_Event row, persistence failure creates no row, performs no retry or duplicate attempt, preserves Search_Response, and exposes the typed incomplete-telemetry limitation; verify all no-event exclusions, safe fields, admin authorization, bounded reports, active-season behavior, and no phrase leakage. Confirm the `q` transport value is allowed only at `GET /api/search`, is redacted from request/error/rate-limit logs, and raw or normalized phrases are not copied into navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads.
    - _Requirements: 4.15, 9.7–9.9, 12.1–12.20_
  - [x] 10.7 Run Verification Criterion 10 from `requirements.md`.
    - Re-run frontend search tests and Playwright and verify analytics leaves Search_Response, browser-local history, Player_Shell availability, excluded routes, and player/admin surface boundaries unchanged.
    - _Requirements: 5.1–5.20, 6.1–6.14, 9.3–9.4, 9.8–9.9, 11.1–11.6, 12.8, 12.11–12.13, 12.21_
  - [x] 10.8 Run Verification Criterion 11 from `requirements.md`.
    - Execute the specified phrase-leakage grep and verify `Season_Rollover` purges active-season Search_Analytics_Event rows without creating an archive; confirm the `q` transport value is allowed only at the `GET /api/search` endpoint and redacted from request/error/rate-limit logs, while raw or normalized phrases are not copied into navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads.
    - _Requirements: 4.15, 10.1–10.6, 12.13, 12.19–12.20_
  - [x] 10.9 Run all relevant blocking project gates after the targeted criteria.
    - Backend: `pnpm run lint`, `pnpm run build`, `pnpm run typecheck:tests`, `pnpm run test:tiers:verify`, `pnpm run test:unit`, `pnpm run test:integration`, and `pnpm run test:heavy` from `app/backend`.
    - Frontend: `pnpm run lint`, `pnpm run build`, and `pnpm run test:ci` from `app/frontend`, plus the required Playwright command.
    - Inspect the applicable CI/deploy workflow steps for `continue-on-error`, `|| true`, unguarded pipes, and missing `needs:` relationships; fix any bypass or add a documented, expiring exclusion only when technically unavoidable. Do not treat an exit code hidden by a pipe as a pass.
    - _Requirements: 9.1–9.9, 10.1–10.6_
  - [x] 10.10 Only after Verification Criteria 1–11 and the relevant blocking project gates have been executed successfully, update item #27 in `docs/BACKLOG.md` to describe the delivered robots/stables/guide search-only palette and admin analytics scope; explicitly retain the broader players/weapons/pages/battle-history/commands scope as deferred and do not record an unrun check as passed.
    - _Requirements: 10.7_
  - _Requirements: 1.1–12.21_

## Notes

- Every task is mandatory; there are no optional or advisory tasks.
- The backend unit/property files belong to the Unit_Tier, PostgreSQL/supertest files belong to the Integration_Tier, and `app/backend/jest.tiers.js` must assign every new test file to exactly one tier.
- Property-based tasks 6.2–6.6, 6.8–6.9, 6.11–6.15, and 7.3–7.6 each implement one distinct design property with at least 100 fast-check runs where applicable; the corresponding tests must include the required `Feature: universal-search, Property N:` comment.
- Mobile assertions are mandatory for both player and admin surfaces: supported widths begin at 320px, layouts must avoid horizontal overflow, and interactive targets must be at least 44px by 44px.
- The final verification group runs the concrete checks in `requirements.md`; it must not use `continue-on-error`, `|| true`, an unguarded output pipe, or an undocumented test exclusion.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.2", "3.1", "3.2", "4.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.6", "2.3", "2.4", "2.5", "3.3", "4.2", "4.5"] },
    { "id": 2, "tasks": ["1.4", "2.1", "4.3", "4.6"] },
    { "id": 3, "tasks": ["1.5", "1.7", "2.6", "4.4", "5.1"] },
    { "id": 4, "tasks": ["1.8", "2.7", "3.4", "5.2"] },
    { "id": 5, "tasks": ["5.3", "6.1", "6.7", "6.10", "6.16", "7.1", "7.2", "7.5", "7.7", "7.8"] },
    { "id": 6, "tasks": ["5.4", "5.5", "6.2", "6.8", "7.3", "7.6", "7.9", "7.10"] },
    { "id": 7, "tasks": ["5.6", "6.3", "6.9", "7.4"] },
    { "id": 8, "tasks": ["6.4", "6.11"] },
    { "id": 9, "tasks": ["6.5", "6.12", "8.1", "8.2", "8.4", "8.7"] },
    { "id": 10, "tasks": ["6.6", "6.13", "8.3", "8.5", "9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8"] },
    { "id": 11, "tasks": ["6.14", "6.17", "9.9"] },
    { "id": 12, "tasks": ["6.15"] },
    { "id": 13, "tasks": ["8.6", "10.1"] },
    { "id": 14, "tasks": ["8.8", "10.2"] },
    { "id": 15, "tasks": ["10.3"] },
    { "id": 16, "tasks": ["10.4"] },
    { "id": 17, "tasks": ["10.5"] },
    { "id": 18, "tasks": ["10.6"] },
    { "id": 19, "tasks": ["10.7"] },
    { "id": 20, "tasks": ["10.8"] },
    { "id": 21, "tasks": ["10.9"] },
    { "id": 22, "tasks": ["10.10"] }
  ]
}
```
