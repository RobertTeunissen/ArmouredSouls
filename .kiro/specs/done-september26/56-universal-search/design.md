# Design: Universal Search

## Glossary

- **Universal_Search_System**: The authenticated player-facing search feature covering robots, stables, guide articles, the Search_Palette, browser-local history, and measurement-only analytics.
- **Search_Backend**: The backend validation, authorization, source-query, ranking, response-shaping, and analytics orchestration for the Universal_Search_System.
- **Search_Client**: The React trigger, Search_Palette, route builder, typed API client, debounce/request-generation logic, and browser-local history adapter.
- **Search_Palette**: The search-only dialog opened by the Search_Control or Search_Keyboard_Shortcut; it contains results and Recent_Search_History but no command actions.
- **Search_Trigger**: The visible desktop or mobile control that opens the Search_Palette without changing the current route.
- **Search_Keyboard_Shortcut**: Cmd+K on macOS and Ctrl+K on other platforms; it is an accelerator, not the sole discovery mechanism.
- **Authenticated_Player**: A signed-in player accepted by the existing JWT authentication middleware.
- **Search_Endpoint**: The authenticated `GET /api/search` endpoint used for all three MVP_Search_Category values.
- **Search_Query**: The raw `q` value submitted to the Search_Endpoint.
- **Normalized_Query**: Search_Query after removal of leading and trailing whitespace only. Internal whitespace and all other characters remain unchanged.
- **Minimum_Query_Length**: Two characters after Normalized_Query processing. A shorter valid query has an empty grouped response and does not query sources.
- **Maximum_Query_Length**: 100 characters after trimming. It is enforced by the Search_Endpoint schema.
- **Malformed_Search_Input**: Missing, repeated, non-string, unknown-key, or otherwise schema-invalid Search_Query input.
- **MVP_Search_Category**: One of `robots`, `stables`, or `guide`.
- **Result_Group**: One category-labelled collection in a Search_Response.
- **Search_Response**: The bounded response containing exactly one Result_Group for each MVP_Search_Category.
- **Search_Result**: One bounded, discriminated, player-safe result reference.
- **Target_Route**: The approved client route opened when an Authenticated_Player selects a Search_Result.
- **Player_Safe_Reference**: A Search_Result containing only the identity and display fields required for navigation; it is not a full entity record.
- **Robot_Result**: A Search_Result matched only against a robot `name`, targeting `/robots/:id`.
- **Stable_Result**: A Search_Result matched only against a trimmed, non-empty `stableName`, targeting `/stables/:userId`.
- **Guide_Result**: A Search_Result matched through the existing Guide_Search_Index, targeting `/guide/:sectionSlug/:articleSlug`.
- **Guide_Search_Index**: The existing `GuideService.getSearchIndex()` output containing guide title, description, section context, slug values, and body text used only for matching.
- **Exact_Match**: A case-insensitive match where Normalized_Query equals the complete searchable value.
- **Prefix_Match**: A case-insensitive match where the searchable value begins with Normalized_Query but is not exact.
- **Substring_Match**: A case-insensitive match where the searchable value contains Normalized_Query but is neither exact nor prefix.
- **Match_Rank**: The ordering class Exact_Match before Prefix_Match before Substring_Match.
- **Per_Category_Result_Limit**: The maximum of 10 Search_Result values in one Result_Group.
- **Total_Result_Limit**: The maximum of 30 Search_Result values in one Search_Response.
- **Search_Debounce_Window**: The 200-millisecond interval after the latest input change before an eligible Search_Endpoint request.
- **Recent_Search**: One non-empty Normalized_Query stored in the current browser after submission or result selection.
- **Recent_Search_History**: The current browser’s ordered set of at most five unique Recent_Search values, newest first and unique case-insensitively.
- **Clear_History_Control**: The accessible Search_Palette control that removes all Recent_Search_History values from the current browser.
- **Search_State**: One Search_Palette presentation: loading, results, recent-history, too-short, empty, or error.
- **Access_Context**: The existing owner/non-owner, not-found, sanitization, and authorization behavior applied by the selected destination page.
- **Search_Error**: A player-safe error presentation that reveals no backend, database, filesystem, account, or raw-query detail.
- **Global_Header**: The existing `Navigation` component: the desktop fixed top navbar and the mobile fixed top header. It is not bottom navigation or the `More` drawer.
- **Player_Shell**: The shared authenticated route layout that renders exactly one `Navigation` and one Search_Palette around every Post_Onboarding_Player_Route.
- **Post_Onboarding_Player_Route**: An authenticated player route available after onboarding, excluding `/onboarding`, login/register/front-page routes, and `/admin` plus all admin descendants.
- **Search_Control**: The visible desktop control labelled `Search` with a visible `⌘ K` or `Ctrl K` hint, or the visible mobile search icon/button in the fixed top header.
- **Accessible_Result_List**: The grouped result list operable by pointer, keyboard, and assistive technology.
- **Search_Analytics_Store**: The dedicated persistence boundary for Search_Analytics_Event rows, separate from `audit_logs`, browser-local history, and Search_Response shaping.
- **Search_Analytics_Event**: One server-side measurement row for one completed eligible Search_Endpoint execution.
- **Executed_Search**: One authenticated Search_Endpoint request with valid input, a Normalized_Query of at least Minimum_Query_Length, an accepted request-protection decision, and a completed grouped search.
- **Normalized_Search_Phrase**: The exact Normalized_Query stored in a Search_Analytics_Event and exposed only in authorized Admin_Search_Analytics_Resource reporting.
- **Active_Season_Context**: The server-captured active season number and cycle associated with an Executed_Search at event-write time.
- **Search_Analytics_Report**: The bounded admin-only aggregate containing search totals, unique searchers, cycle trends, phrase summaries, no-result phrases, category usage, and paginated per-player/stable analysis.
- **Admin_Search_Analytics_Resource**: The admin-only API and page for Search_Analytics_Report values.
- **Admin_Search_Analytics_Page**: The new Admin_Portal page at `/admin/search-analytics` that displays Search_Analytics_Report values.
- **Telemetry_Fail_Open**: The rule that Search_Response remains successful when Search_Analytics_Store persistence fails; the failure is observable internally and reported as a limitation to administrators.
- **Search_Persistence_Failure**: A failure while writing or querying Search_Analytics_Event values, distinct from failure of the player Search_Backend source search.
- **Season_Rollover**: The existing operation that archives the completed season, purges season-scoped operational data, and opens the next season.
- **Admin_Portal**: The existing administrator-only application area under `/admin`, separate from the Player_Shell.

## Overview

The Universal_Search_System adds one authenticated, search-only surface to the existing application. The MVP searches exactly three categories: robots by `Robot.name`, stables by trimmed non-empty `User.stableName`, and guide articles through the existing Guide_Search_Index. One `GET /api/search?q=...` request returns three independently ranked and bounded Result_Group values. The response contains Player_Safe_Reference values only; destination pages remain authoritative for Access_Context.

The player surface is composed once through a new Player_Shell route layout. The existing `Navigation` component remains the Global_Header: its desktop fixed top navbar receives a visibly labelled `Search` Search_Control and a visible `⌘ K`/`Ctrl K` hint, while its mobile fixed top header receives a visible search icon/button. The mobile control is not placed in bottom navigation or the `More` drawer. The Search_Palette visibly states `Search robots, stables, or guide articles`, and Cmd/Ctrl+K accelerates discovery without being the sole way to find it.

The feature also creates a dedicated Search_Analytics_Store backed by a new `SearchAnalyticsEvent` model mapped to `search_analytics_events`. Each eligible completed Executed_Search, including zero-result searches, causes exactly one Search_Analytics_Store write attempt. A successful attempt creates exactly one Search_Analytics_Event row. A persistence failure creates no row, performs no retry or duplicate attempt, preserves the successful unchanged Search_Response, and is surfaced to the Admin_Search_Analytics_Resource as a typed incomplete-telemetry limitation under Telemetry_Fail_Open. Short, malformed, over-length, unauthenticated, rate-limited, or failed searches cause no attempt. Keystrokes, Recent_Search_History operations, result selections, and selected categories also cause no attempt or event. The event captures the authenticated user identity, server-captured Active_Season_Context, server-generated timestamp, exact Normalized_Search_Phrase, category counts, total count, and no-result status.

The `q` value is permitted only as transport at `GET /api/search?q=...`. Request, error, and rate-limit logs use a query-free safe path; raw Search_Query and Normalized_Search_Phrase are never copied into application navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads. A pre-existing result display label that coincidentally equals or contains the query remains valid result content. Raw phrases are available only through authorized Admin_Search_Analytics_Resource reporting.

The Admin_Portal gains an Admin_Search_Analytics_Page at `/admin/search-analytics`, backed by `GET /api/admin/search-analytics/report`. It is protected by the existing admin authorization boundary, reports only the active season, supports cycle-range filtering and bounded pagination, and provides totals, unique searchers, trends, top phrases, no-result phrases, category usage, and safe per-player/stable analysis. Raw event rows are not exposed to players. Search_Analytics_Event rows are retained only for the active season and are purged by Season_Rollover; the MVP creates no cross-season archive.

### Research findings that inform the design

- `app/frontend/src/App.tsx` currently wraps individual page elements in `ProtectedRoute`, and `Suspense` is outside the route content. This can hide `Navigation` during a lazy-page loading fallback. The Player_Shell must move the shared shell above page loading/error/not-found content and keep `/onboarding`, auth/front-page routes, and `/admin` outside it.
- `app/frontend/src/components/Navigation.tsx` is the current desktop fixed navbar and mobile fixed header, while each page currently imports it separately. Search composition belongs in a route layout, with `Navigation` receiving only Search_Control callbacks and Search_Palette rendered by Player_Shell.
- `app/backend/src/index.ts` mounts `/api/admin` through `app/backend/src/routes/admin.ts`, applies the general `/api` limiter globally, and applies the per-user limiter through an explicit prefix list. `/api/search` must be added to the authenticated per-user prefix list without creating a second search rate-limit policy.
- `app/backend/src/routes/adminAnalytics.ts` is the existing admin analytics route module, and `app/frontend/src/components/admin/AdminLayout.tsx` owns the admin sidebar, title map, lazy-page outlet, loading fallback, and content error boundary. Search Analytics extends these exact boundaries rather than creating a second admin portal.
- `app/backend/src/services/common/guide-service.ts` already provides `GuideService.getSearchIndex()`. The Universal_Search_System consumes this index and does not create a second filesystem parser or return body content.
- `app/backend/src/services/season/seasonPurgeService.ts` purges operational history through `purgeHistory()`, and `app/backend/src/services/season/seasonRolloverService.ts` invokes it during Stage 3. `search_analytics_events` must be added to that fixed active-season purge set.
- `.kiro/steering/frontend-standards.md` requires the 1024px desktop/mobile breakpoint, focused feature components, typed API helpers, visible focus, and mobile-first layouts. `.kiro/steering/testing-strategy.md` requires fast-check for pure properties, PostgreSQL for database integration, and blocking tests without advisory bypasses.

## Architecture

### System boundary

```mermaid
flowchart LR
    Player[Authenticated_Player] --> Shell[Player_Shell]
    Shell --> Header[Global_Header / Navigation]
    Header --> Trigger[Search_Control]
    Trigger --> Palette[Search_Palette]
    Shortcut[Cmd+K / Ctrl+K accelerator] --> Palette
    Palette -->|GET /api/search?q=...| Auth[authenticateToken]
    Auth --> Protect[General + per-user request protection]
    Protect --> Validate[Strict q validation]
    Validate --> Service[Search_Backend]
    Service --> Robot[(robots / Robot.name)]
    Service --> Stable[(users / User.stableName)]
    Service --> Guide[Guide_Search_Index]
    Robot --> Rank[Rank + shape + limit]
    Stable --> Rank
    Guide --> Rank
    Rank --> Response[Search_Response]
    Response --> Palette
    Service --> Eligible{Eligible completed search?}
    Eligible -->|yes: exactly one attempt| Attempt[One Search_Analytics_Store write attempt]
    Eligible -->|no| NoTelemetry[No analytics attempt or event]
    Attempt -->|success: exactly one row| Events[(search_analytics_events)]
    Attempt -->|failure: no row, no retry| Limitation[Typed incomplete-telemetry limitation]
    Attempt --> SafeLogs[Phrase-free safe diagnostics]
    Admin[Admin_Portal] --> Report[GET /api/admin/search-analytics/report]
    Report --> Telemetry
    Rollover[Season_Rollover] --> Purge[seasonPurgeService.purgeHistory]
    Purge --> Events
    Palette --> Routes[/robots/:id, /stables/:userId, /guide/:sectionSlug/:articleSlug]
```

### Player route layout and shell ownership

`app/frontend/src/App.tsx` will use a nested route layout rather than wrapping each page with an independent `Navigation`. The protected route tree will have this shape conceptually:

```tsx
<Route element={<ProtectedRoute><PlayerShell /></ProtectedRoute>}>
  <Route path="/dashboard" element={<DashboardPage />} />
  {/* all Post_Onboarding_Player_Route entries */}
</Route>
<Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
<Route path="/login" element={<FrontPage />} />
<Route path="/" element={<FrontPage />} />
<Route path="/admin/*" element={<AdminRoute><AdminLayout /></AdminRoute>} />
```

`app/frontend/src/components/layout/PlayerShell.tsx` owns one `useSearchPalette()` instance, renders exactly one `Navigation` and exactly one `SearchPalette`, and places the page `Outlet` inside the shell. The `Suspense` fallback and the post-onboarding route-level error/not-found states are rendered inside the shell, so Global_Header and Search_Palette remain available while content is loading, fails, or is not found. `/onboarding`, `/login`, `/register` if present, `/`, front-page routes, `/admin`, and admin descendants have no Player_Shell-owned Search_Control or Search_Palette.

`Navigation.tsx` continues to own the desktop fixed top navbar and mobile fixed top header. It receives an `onOpenSearch` callback and renders the Search_Control in both responsive header variants. It does not render Search_Palette itself. This removes page-by-page `Navigation` imports from the shell-managed pages and prevents duplicate headers or duplicate palettes.

### Request path

1. The general `/api` limiter runs for `/api/search`.
2. `authenticateToken` runs before the per-user limiter. `/api/search` is added to the existing per-user prefix list in `app/backend/src/index.ts`, so the authenticated user is the limiter key and the existing player-safe 429 response is retained.
3. `validateRequest({ query: searchQuerySchema })` accepts exactly `q`, rejects unknown keys, repeated values, missing values, non-string values, and trimmed values longer than 100 characters. It trims only leading/trailing whitespace and replaces `req.query` with the validated value.
4. `app/backend/src/routes/search.ts` remains thin: it reads the validated query and authenticated request context, calls `searchService.search()`, and returns Search_Response. No route-local Prisma query or helper is defined.
5. The service returns `{ robots: [], stables: [], guide: [] }` immediately for a valid Normalized_Query shorter than two characters. It does not call Prisma or `getSearchIndex()` in this branch.
6. For an eligible query, the service reads only the approved source fields, ranks each category independently, applies category limits after ranking, and returns the fixed category order `robots`, `stables`, `guide`.
7. After the grouped search completes, the service hands the response counts, exact Normalized_Search_Phrase, and server-captured Active_Season_Context to `searchAnalyticsService.recordExecutedSearch()`. This is the only analytics boundary: it performs exactly one Search_Analytics_Store write attempt for the eligible Executed_Search, including a zero-result response. A successful attempt creates exactly one Search_Analytics_Event row. A Search_Persistence_Failure creates no row and is not retried or duplicated; the unchanged Search_Response is still returned and the admin report can expose a typed incomplete-telemetry limitation under Telemetry_Fail_Open. Short, malformed, over-length, unauthenticated, rate-limited, and failed requests exit before this step, as do client-only keystrokes, history operations, result selections, and selected categories.
8. The transport `q` exists only on the Search_Endpoint URL. Before request, error, or rate-limit diagnostics are emitted, the endpoint path is sanitized to omit its query string. Neither raw Search_Query nor Normalized_Search_Phrase is copied into navigation URLs, redirects, Target_Route values, player responses, ordinary application logs, or general `audit_logs` payloads; an existing result label that happens to contain the query is not treated as a leak.

### Search ranking and limits

`app/backend/src/services/search/searchRanking.ts` is pure and is the oracle for unit/property tests. It exposes normalization, match classification, guide multi-field maximum-rank selection, deterministic ordering, and limit helpers. Comparisons lower-case values for matching but do not alter the stored/display value, internal whitespace, or non-whitespace characters.

- A candidate is included only if a searchable value contains Normalized_Query case-insensitively.
- Exact_Match precedes Prefix_Match, which precedes Substring_Match.
- A Guide_Result receives the highest Match_Rank produced by its title, description, or body text. Section title is display context, not an additional searchable field.
- Robot ties use lower-case `name`, then numeric `id`.
- Stable ties use lower-case trimmed `stableName`, then numeric `userId`.
- Guide ties use lower-case `title`, then `sectionSlug`, then `articleSlug`.
- Each category is sorted and limited independently to 10. The response preserves the three groups and therefore never applies a second cross-category rank. The three limits total at most 30.
- No fuzzy, phonetic, edit-distance, or approximate matching is implemented.

Robot and stable source adapters use Prisma `select` fields and parameterized `where` conditions. They may use Prisma query APIs or tagged `prisma.$queryRaw` for bounded database-side ordering, but never concatenate Search_Query into SQL. Guide entries are ranked in memory from the existing index.

### Analytics capture and isolation

`searchAnalyticsService.recordExecutedSearch()` receives only a completed Search_Response, the exact Normalized_Search_Phrase, and an Active_Season_Context resolved on the server. It never receives browser history, selection events, keystrokes, a selected category, or a client-supplied identity. The eligible request path calls the store exactly once and captures:

- authenticated `userId`;
- active `seasonNumber` and `cycleNumber`;
- server-generated `eventTimestamp`;
- exact trimmed `normalizedPhrase`;
- `robotResultCount`, `stableResultCount`, `guideResultCount`, `totalResultCount`; and
- `noResult` derived from total count equal to zero.

The Search_Response is fully built before the one telemetry write attempt and is returned independently. A successful store attempt creates exactly one Search_Analytics_Event row. A Search_Persistence_Failure creates no event row, is never retried or duplicated, and cannot mutate or append fields to the successful Search_Response. The fail-open boundary emits only safe internal diagnostics and exposes a typed incomplete-telemetry limitation to the Admin_Search_Analytics_Resource; it does not make player search fail. Requests that are not Executed_Search values, including short, malformed, over-length, unauthenticated, rate-limited, or source-failed requests, never call the store.

The transport request necessarily carries `q` in the `GET /api/search?q=...` URL, but this is the only permitted transport occurrence. `safeRequestPath` removes the query string from request, error, and rate-limit logs. Raw Search_Query and Normalized_Search_Phrase are never copied into application navigation URLs, redirects, Target_Route values, player responses, ordinary application logs, or general `audit_logs` payloads. A legitimate pre-existing result display label that happens to equal or contain the query remains allowed result content. Raw phrases are available only through authorized Admin_Search_Analytics_Resource aggregate fields.

### Admin report path

`GET /api/admin/search-analytics/report` is mounted through the existing `adminAnalytics.ts` router and guarded by `authenticateToken`, `requireAdmin`, and strict query validation. The query accepts only bounded cycle filters and pagination, for example `cycleFrom`, `cycleTo`, `page`, and `limit`; the service always resolves the active season server-side and rejects historical-season requests because the MVP has no cross-season event archive.

`searchAnalyticsReportService` uses set-based queries against `search_analytics_events`, joins current `User` display context only for authorized bounded per-player/stable analysis, and returns one report envelope containing:

- active season and normalized cycle filter;
- total searches and unique searchers;
- per-cycle totals/trends;
- top normalized phrases;
- no-result phrases;
- category usage totals;
- bounded, paginated player/stable rows with page metadata; and
- a typed incomplete-telemetry limitation when the Search_Analytics_Store reports an observed persistence failure for the requested scope.

The limitation is an operational/report status, not a synthesized Search_Analytics_Event row, and it never triggers a retry or exposes a failed phrase. No raw event identity, database payload, password, token, or player-facing response is returned. Non-admin requests receive the existing admin authorization failure without analytics data. The report page is a separate Admin_Portal surface and is not reachable through Player_Shell or the player Search_Palette.

### Active-season retention

`SearchAnalyticsEvent` rows are operational active-season data. `app/backend/src/services/season/seasonPurgeService.ts` adds `search_analytics_events` to the fixed `purgeHistory()` table list before `Season_Rollover` opens the next season. The purge remains explicit and observable in `rowsDeleted`; no archive table or cross-season analytics copy is introduced. The active season/cycle fields remain useful for in-season filters and trends, while rollover guarantees that raw phrase history does not survive into a later season.

## Components and Interfaces

### Backend files and responsibilities

| File | Responsibility |
|---|---|
| `app/backend/src/routes/search.ts` | New thin authenticated `GET /api/search` route using `validateRequest` and delegating to `searchService`. |
| `app/backend/src/schemas/search.ts` | Strict Zod schema for exactly `q`, trimming it and enforcing `Maximum_Query_Length`; field-specific validation messages. |
| `app/backend/src/services/search/searchService.ts` | Orchestrates robot, stable, and Guide_Search_Index sources; short-query branch; ranking; shaping; category/total limits; response isolation. |
| `app/backend/src/services/search/searchRanking.ts` | Pure normalization, Match_Rank classification, guide max-rank, deterministic sorting, and limit functions. |
| `app/backend/src/services/search/searchReferenceBuilder.ts` | Builds allow-listed Robot_Result, Stable_Result, and Guide_Result values and approved Target_Route fields. |
| `app/backend/src/services/search/searchTypes.ts` | Backend source types, discriminated Search_Result union, Search_Response, rank types, and analytics count types. |
| `app/backend/src/services/search/searchAnalyticsService.ts` | Captures Active_Season_Context, constructs Search_Analytics_Event data, performs exactly one write attempt for each eligible completed search, never retries, preserves Search_Response on failure, signals the typed incomplete-telemetry limitation, and applies Telemetry_Fail_Open. |
| `app/backend/src/services/search/searchAnalyticsReportService.ts` | Admin-only active-season aggregation, cycle filtering, phrase/category metrics, typed incomplete-telemetry limitation, and bounded/paginated per-player/stable analysis. |
| `app/backend/src/services/search/searchAnalyticsTypes.ts` | Typed event, report, trend, phrase, category, pagination, and incomplete-telemetry limitation shapes. |
| `app/backend/src/services/search/searchAnalyticsStore.ts` | Dedicated persistence adapter for `search_analytics_events`; exposes one-write-attempt results/limitation status and never uses `audit_logs` for Search_Analytics_Event rows. |
| `app/backend/src/utils/safeRequestPath.ts` | Returns `/api/search` without its query string for ordinary diagnostics and preserves existing behavior for other paths. |
| `app/backend/src/routes/adminAnalytics.ts` | Adds admin `GET /search-analytics/report` with strict query schema and existing authorization middleware. |
| `app/backend/src/index.ts` | Imports/mounts `searchRoutes`, adds `/api/search` to the existing authenticated per-user limiter prefixes, and leaves the global limiter in place. |
| `app/backend/src/middleware/requestLogger.ts` | Redacts the Search_Query from ordinary request logs through `safeRequestPath`. |
| `app/backend/src/middleware/errorHandler.ts` | Keeps validation, rate-limit, dependency, and telemetry errors player-safe and phrase-free. |
| `app/backend/src/middleware/schemaValidator.ts` | Uses the safe path for validation diagnostics and never logs raw Search_Query. |
| `app/backend/src/services/season/seasonPurgeService.ts` | Adds `search_analytics_events` to active-season history purge. |
| `app/backend/prisma/schema.prisma` | Adds `SearchAnalyticsEvent` and the `User.searchAnalyticsEvents` relation, with active-season/cycle/query/reporting indexes. |
| `app/backend/prisma/migrations/<generated-search-analytics-migration>/migration.sql` | Creates `search_analytics_events` and indexes through the normal Prisma migration workflow; the timestamp is assigned when implementation creates the migration. |

### Player shell and frontend files

| File | Responsibility |
|---|---|
| `app/frontend/src/components/layout/PlayerShell.tsx` | Shared route layout; owns one palette state instance, exactly one `Navigation`, exactly one Search_Palette, and inner loading/error/not-found content. |
| `app/frontend/src/App.tsx` | Moves all Post_Onboarding_Player_Route elements under Player_Shell; leaves onboarding, auth/front-page, and `/admin` trees outside. |
| `app/frontend/src/components/Navigation.tsx` | Existing Global_Header; renders desktop Search_Control labelled `Search` with visible `⌘ K`/`Ctrl K` hint and mobile search icon/button in the fixed top header. It does not render Search_Palette. |
| `app/frontend/src/components/search/SearchTrigger.tsx` | Accessible desktop/mobile trigger, 44px minimum activation region, visible focus, and non-shortcut discovery. |
| `app/frontend/src/components/search/SearchPalette.tsx` | Search-only dialog with visible scope text, grouped states/results/history, no command actions, and responsive overlay/sheet layout. |
| `app/frontend/src/components/search/SearchResultList.tsx` | Accessible grouped Result_Group rendering, pointer/keyboard activation, arrow-key movement, category labels, and result route callback. |
| `app/frontend/src/components/search/SearchHistoryList.tsx` | Recent_Search_History display, selection, Clear_History_Control, and accessible labels. |
| `app/frontend/src/components/search/useSearchPalette.ts` | 200ms debounce, no request for short queries, AbortController/request-generation stale protection, focus trap/restoration, selection order, and retry. |
| `app/frontend/src/utils/searchApi.ts` | Typed `api.get<SearchResponse>('/api/search', { params: { q }, signal })`; no second universal search request and no history payload. |
| `app/frontend/src/utils/searchTypes.ts` | Frontend safe DTO union with no full entity types or analytics fields. |
| `app/frontend/src/utils/searchHistory.ts` | Pure bounded history insertion/sanitization plus guarded `localStorage` adapter. |
| `app/frontend/src/utils/searchRoutes.ts` | Validates result identities and constructs only the three approved Target_Route forms; never uses raw Search_Query or username. |
| `app/frontend/src/components/admin/AdminLayout.tsx` | Adds the Search Analytics sidebar item and page title while retaining the existing admin-only layout. |
| `app/frontend/src/pages/admin/SearchAnalyticsPage.tsx` | New Admin_Search_Analytics_Page with active-season filters, report totals/trends, phrase/category sections, and paginated player/stable analysis. |
| `app/frontend/src/pages/admin/__tests__/SearchAnalyticsPage.test.tsx` | Admin authorization-safe rendering, report states, pagination, limitation display, and responsive component coverage. |
| `app/frontend/src/utils/adminSearchAnalyticsApi.ts` | Typed client for `GET /api/admin/search-analytics/report`; no player route imports or player response coupling. |
| `app/frontend/src/pages/admin/__tests__/SearchAnalyticsPage.mobile.test.tsx` | Mobile stacked layout, 44px controls, and no-overflow assertions at the supported viewport range. |

### Player HTTP interface

`GET /api/search?q={Search_Query}` is authenticated and accepts exactly one query key, `q`.

```typescript
interface SearchResponse {
  robots: RobotSearchResult[];
  stables: StableSearchResult[];
  guide: GuideSearchResult[];
}

type SearchResultBase = {
  category: 'robots' | 'stables' | 'guide';
};

interface RobotSearchResult extends SearchResultBase {
  category: 'robots';
  id: number;
  label: string;
  subtitle?: string;
}

interface StableSearchResult extends SearchResultBase {
  category: 'stables';
  userId: number;
  label: string;
}

interface GuideSearchResult extends SearchResultBase {
  category: 'guide';
  title: string;
  sectionTitle: string;
  sectionSlug: string;
  articleSlug: string;
}
```

The response contains no `username`, `profileVisibility`, `bodyText`, complete article body, password, token, private field, arbitrary route, raw database payload, or unrelated-account data. The client reconstructs Target_Route from validated identity fields rather than trusting an arbitrary server-provided route string.

Validation failures preserve the existing `{ error, code: 'VALIDATION_ERROR', details? }` envelope. Authentication failures preserve the existing authentication response. Rate limits preserve status 429, `RATE_LIMIT_EXCEEDED`, and `Retry-After`. Dependency failures return the existing generic player-safe internal error envelope and do not include raw query text.

### Admin analytics HTTP interface

`GET /api/admin/search-analytics/report` is authenticated, admin-authorized, and strict-schema validated. It accepts only bounded query fields such as:

```typescript
interface SearchAnalyticsReportQuery {
  cycleFrom?: number;
  cycleTo?: number;
  page?: number;
  limit?: number;
}
```

The service resolves the active season and rejects a cycle range outside that active context. The response is shaped as:

```typescript
interface SearchAnalyticsReport {
  period: {
    seasonNumber: number;
    cycleFrom: number | null;
    cycleTo: number | null;
  };
  overview: {
    totalSearches: number;
    uniqueSearchers: number;
    noResultSearches: number;
  };
  trends: Array<{
    cycleNumber: number;
    totalSearches: number;
    uniqueSearchers: number;
    noResultSearches: number;
  }>;
  topPhrases: Array<{ phrase: string; count: number }>;
  noResultPhrases: Array<{ phrase: string; count: number }>;
  categoryUsage: { robots: number; stables: number; guide: number };
  playerAnalysis: {
    entries: Array<{ userId: number; stableName: string | null; searchCount: number; noResultCount: number }>;
    page: number;
    limit: number;
    total: number;
  };
  limitations: Array<{ code: 'analyticsDataIncomplete'; message: string }>;
}
```

The exact field names are implementation contract candidates and must remain player-safe. Raw event IDs, payloads, database identities beyond the bounded authorized analysis, and event-level rows are not returned. No click, selected-result, selected-category, keystroke, or browser-history data is included.

### Search_Palette interaction contract

- Opening Search_Control does not navigate; it focuses the query input and stores the opening control for restoration.
- The palette visibly renders `Search robots, stables, or guide articles` or equivalent text naming all three categories.
- Cmd+K on macOS and Ctrl+K elsewhere call `preventDefault()`, open the palette, and focus the input. The visible Search_Control remains available independently.
- Query changes restart a 200ms timer. The client increments a request generation before each eligible request. AbortController is an optimization; generation equality is the correctness guard.
- Fewer than two normalized characters produce too-short or recent-history state without a request. An empty eligible query shows history or empty-history state.
- Result selection stores the normalized query, closes the palette, then navigates from the validated result identity. It never sends a selection analytics event.
- Escape dismisses; Tab and Shift+Tab remain inside the dialog; Arrow keys move through the Accessible_Result_List; Enter activates a focused result; focus returns to the opening Search_Control when available.
- Desktop (at least 1024px) uses a bounded overlay with the page visible behind it. Mobile (320px–1023px) uses a vertically ordered, internally scrollable sheet with no horizontal overflow.

### Admin page interaction contract

`SearchAnalyticsPage.tsx` is lazy-loaded under `/admin/search-analytics`. It displays a loading state, player-safe error state, active-season/cycle filter controls, report totals, trend rows, phrase summaries, category usage, and bounded paginated per-player/stable analysis. At widths below 1024px it stacks sections and controls vertically; at widths from 320px through 1023px it prevents horizontal overflow and keeps every filter, pagination, retry, and navigation control at least 44px by 44px. It uses the existing AdminLayout rather than Navigation or Player_Shell, and it never renders for a player route.

## Data Models

### Existing source data

| Source | Selected fields | Eligibility and use |
|---|---|---|
| `Robot` / `robots` | `id`, `name`, `userId`, related `User.stableName` | Match only `name`; use trimmed non-empty `stableName` as an optional robot subtitle. |
| `User` / `users` | `id`, `stableName` | Match only trimmed non-empty `stableName`; do not filter `isGenerated`; do not use `username`; do not apply `profileVisibility` as a new rule. |
| `GuideService.getSearchIndex()` | title, description, body text, section title, section slug, article slug | Match title/description/body text; return title/section/slugs only. |

A null, empty, or whitespace-only `stableName` is ineligible. Generated and seeded test stables participate when their trimmed `stableName` is non-empty. The destination pages still decide current access and sanitization.

### Search analytics persistence model

The Prisma schema adds a dedicated model and table:

```prisma
model SearchAnalyticsEvent {
  id                  BigInt   @id @default(autoincrement())
  seasonNumber        Int      @map("season_number")
  cycleNumber         Int      @map("cycle_number")
  userId              Int      @map("user_id")
  eventTimestamp      DateTime @map("event_timestamp")
  normalizedPhrase    String   @map("normalized_phrase") @db.VarChar(100)
  robotResultCount    Int      @map("robot_result_count")
  stableResultCount   Int      @map("stable_result_count")
  guideResultCount    Int      @map("guide_result_count")
  totalResultCount   Int      @map("total_result_count")
  noResult           Boolean  @map("no_result")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([seasonNumber, cycleNumber])
  @@index([seasonNumber, eventTimestamp])
  @@index([seasonNumber, userId])
  @@index([seasonNumber, normalizedPhrase])
  @@map("search_analytics_events")
}
```

The exact generated migration name is assigned by Prisma when implementation creates it. `User.searchAnalyticsEvents` is the only relation added to `User`; Search_Analytics_Event rows are not `AuditLog` rows and do not use `audit_logs`, `AdminAuditLog`, or browser storage. The `userId` relation supports authorized bounded player/stable analysis and cascades account deletion; `purgeHistory()` remains the authoritative active-season rollover cleanup.

The event has no `selectedResult`, `selectedCategory`, keystroke, history operation, or raw response field. `normalizedPhrase` is intentionally raw only within the dedicated store and authorized admin aggregation. It is never emitted to ordinary logs or player responses.

### Backend source and DTO types

```typescript
type MatchRank = 'exact' | 'prefix' | 'substring';
type SearchCategory = 'robots' | 'stables' | 'guide';

interface RobotSearchSource {
  id: number;
  name: string;
  stableName: string | null;
}

interface StableSearchSource {
  userId: number;
  stableName: string | null;
}

interface GuideSearchSource {
  slug: string;
  title: string;
  sectionSlug: string;
  sectionTitle: string;
  description: string;
  bodyText: string;
}

interface ActiveSeasonContext {
  seasonNumber: number;
  cycleNumber: number;
}

interface SearchAnalyticsEventInput extends ActiveSeasonContext {
  userId: number;
  eventTimestamp: Date;
  normalizedPhrase: string;
  robotResultCount: number;
  stableResultCount: number;
  guideResultCount: number;
  totalResultCount: number;
  noResult: boolean;
}
```

Source records are mapped immediately to safe DTOs. The source selectors and response serializer are tested with an allow-list so later Prisma `select` expansion cannot silently expose private fields.

### Frontend state and history model

```typescript
type SearchState = 'closed' | 'loading' | 'results' | 'recent-history' | 'too-short' | 'empty' | 'error';

interface SearchPaletteState {
  isOpen: boolean;
  query: string;
  normalizedQuery: string;
  state: SearchState;
  response: SearchResponse | null;
  errorMessage: string | null;
  activeResultIndex: number | null;
  history: string[];
}
```

History uses the key `armoured-souls:recent-searches`. The adapter parses only a string array, normalizes each entry, discards whitespace-only and over-100-character values, removes case-insensitive duplicates, retains five values, and catches every storage read/write/remove error. Current-query search continues if storage is unavailable or malformed. History is not sent to the backend and does not create Search_Analytics_Event values.

### Constants

The feature defines these constants in the appropriate backend/frontend modules and tests their values:

- `MINIMUM_QUERY_LENGTH = 2`
- `MAXIMUM_QUERY_LENGTH = 100`
- `SEARCH_DEBOUNCE_MS = 200`
- `MAX_RESULTS_PER_CATEGORY = 10`
- `MAX_TOTAL_RESULTS = 30`
- `MAX_RECENT_SEARCHES = 5`
- `RECENT_SEARCH_STORAGE_KEY = 'armoured-souls:recent-searches'`

These are implementation constants; the domain concepts are Minimum_Query_Length, Maximum_Query_Length, Search_Debounce_Window, Per_Category_Result_Limit, Total_Result_Limit, and Recent_Search_History.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties bridge human-readable requirements and executable correctness guarantees.*

PBT applies to pure normalization, matching, ranking, shaping, route construction, local-history, report aggregation, and mocked request-generation logic. It does not replace PostgreSQL integration tests, browser layout tests, authorization tests, or Season_Rollover integration tests. Each property test uses fast-check with at least 100 runs and includes a comment in the required form: `Feature: universal-search, Property N: ...`.

### Property 1: Normalization and case invariance

For any Search_Query and searchable value, Normalized_Query removes only leading/trailing whitespace, normalization is idempotent, and changing case preserves match classification and result identity without silently changing internal whitespace or other characters.

**Validates: Requirements 2.1, 2.2, 4.5**

### Property 2: Scope conservation and no fuzzy matches

For any generated source dataset and query, every Search_Result is derived only from an allowed robot `name`, trimmed non-empty `stableName`, or Guide_Search_Index title/description/body text, and no value that is only edit-distance, phonetic, approximate, username, team, weapon, navigation, command, or battle-history related produces a result.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 2.5, 2.12**

### Property 3: Rank monotonicity and guide maximum rank

For any generated category sources, every Exact_Match precedes every Prefix_Match and every Prefix_Match precedes every Substring_Match within its Result_Group; each Guide_Result uses the highest rank produced by title, description, or body text.

**Validates: Requirements 2.3, 2.4, 2.6**

### Property 4: Deterministic ordering

For any source collection, query, and permutation of that collection, the ordered Search_Result references are identical after Match_Rank and the documented category tie-break are applied.

**Validates: Requirements 2.7**

### Property 5: Independent bounds and top-N selection

For any source collections and valid query, each Result_Group contains at most 10 values, Search_Response contains at most 30 values, and each group equals the first 10 values of that category’s ranked reference order rather than a response-wide rank.

**Validates: Requirements 2.8, 2.9, 2.10, 2.11, 4.7**

### Property 6: Player-safe reference shaping

For any generated source records containing arbitrary extra/private fields, shaping emits only the approved discriminated Search_Result fields, omits empty robot subtitles, omits usernames and article bodies, and assigns only an approved category and Target_Route identity.

**Validates: Requirements 3.1, 3.4, 3.5, 3.6, 3.7, 3.11, 3.12, 3.14, 3.15, 8.8**

### Property 7: Stable eligibility independence

For any account, null/empty/whitespace-only `stableName` produces no Stable_Result, a trimmed non-empty `stableName` may produce one when matched, and changing only `profileVisibility` or `isGenerated` does not change search eligibility or safe display fields.

**Validates: Requirements 1.4, 1.6, 3.9, 3.10**

### Property 8: Approved route construction

For any valid Search_Result reference, the route builder produces exactly `/robots/:id`, `/stables/:userId`, or `/guide/:sectionSlug/:articleSlug` according to its discriminant; arbitrary Search_Query, labels, usernames, arbitrary route strings, non-positive IDs, or unsafe slugs cannot become a Target_Route.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.8**

### Property 9: Recent history bound, uniqueness, order, and idempotence

For any sequence of submitted or selected queries, normalized insertion leaves at most five case-insensitively unique Recent_Search values in newest-first order; repeating a case variant leaves one newest occurrence, and clearing produces an empty history.

**Validates: Requirements 6.3, 6.4, 6.5, 6.6**

### Property 10: Malformed history sanitization

For any browser-local payload containing valid strings, non-strings, malformed JSON values, whitespace-only values, over-length values, duplicates, and valid values, the adapter retains only normalized valid values, removes case-insensitive duplicates, preserves newest-first order, and never returns more than five entries.

**Validates: Requirements 6.12**

### Property 11: Short-query source conservation

For any Search_Query whose Normalized_Query is shorter than two characters, the Search_Client makes no Search_Endpoint request and the Search_Backend returns exactly three empty Result_Group values without invoking entity or Guide_Search_Index sources.

**Validates: Requirements 1.9, 5.15**

### Property 12: Latest-query presentation

For any sequence of debounced eligible queries and any out-of-order mocked responses, the Search_Client presents only the response associated with the latest eligible request generation; an aborted or late earlier response cannot replace the current response.

**Validates: Requirements 5.14, 7.2**

### Property 13: Analytics attempt cardinality, failure isolation, and exclusions

For any generated sequence of request inputs and outcomes, every eligible completed authenticated Search_Endpoint request that passes validation and request protection, including a zero-result search, causes exactly one Search_Analytics_Store write attempt; persistence success creates exactly one Search_Analytics_Event row, while persistence failure creates no row, performs no retry or duplicate attempt, preserves the successful unchanged Search_Response, and exposes a typed incomplete-telemetry limitation under Telemetry_Fail_Open. Short, malformed, over-length, unauthenticated, rate-limited, or failed requests, keystrokes, Recent_Search_History operations, result selections, and selected categories cause no attempt and no event.

**Validates: Requirements 4.15, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8**

### Property 14: Analytics event completeness and phrase non-propagation

For any generated eligible Search_Response and server Active_Season_Context whose one analytics write succeeds, the corresponding Search_Analytics_Event contains exactly the authenticated identity, server-captured season/cycle, server-generated timestamp, exact Normalized_Search_Phrase, three category counts, total count, and no-result status, while the player response remains unchanged and contains no analytics fields. The raw transport `q`, Search_Query, and Normalized_Search_Phrase do not appear in request/error/rate-limit logs, ordinary logs, general `audit_logs` payloads, application navigation URLs, redirects, Target_Route values, or player responses; a pre-existing result display label that coincidentally contains the query remains permitted content.

**Validates: Requirements 4.15, 12.9, 12.10, 12.11, 12.12, 12.13**

### Property 15: Admin analytics aggregation and bounded reporting

For any generated active-season Search_Analytics_Event collection and set of failed Search_Analytics_Store write attempts, an authorized Search_Analytics_Report equals the persisted event set for totals, unique searchers, season/cycle trends, top phrases, no-result phrases, category usage, and bounded paginated per-player/stable analysis; failed attempts are represented only by a typed incomplete-telemetry limitation and never by an invented event row.

**Validates: Requirements 12.14, 12.15, 12.16, 12.17**

### Property 16: Admin authorization and active-season report isolation

For any generated event collection, an administrator can receive only the active-season report and a non-administrator receives no report data; a report never includes events outside the active season or unbounded raw event payloads, and Season_Rollover leaves no retained Search_Analytics_Event or cross-season archive.

**Validates: Requirements 12.18, 12.19, 12.20**

### Non-PBT structural and integration invariants

The following are tested with examples/integration rather than property tests: one Player_Shell mount per post-onboarding route and none for excluded routes; one `Navigation` and one Search_Palette in each shell; exact database event cardinality against PostgreSQL; safe request logging; real admin authorization; active-season purge during Season_Rollover; mobile geometry, overflow, focus, and 44px target assertions; and destination-page not-found/access behavior.

## Error Handling

### Authentication and validation

`authenticateToken` remains the first route-level security boundary. An unauthenticated request receives the existing authentication failure without Search_Response data and without analytics. The strict `searchQuerySchema` rejects missing, repeated, non-string, unknown-key, and over-length values before source or analytics services run. Schema messages name `q` and use the existing validation envelope. A valid one-character or whitespace-normalized-short query is not an error: it returns three empty groups and creates no Search_Analytics_Event.

### Rate limiting

Both the global `/api` limiter and authenticated per-user limiter apply to `/api/search`. Rejection returns the existing 429 response and `Retry-After`, writes no event, and records only a query-free safe path in rate-limit diagnostics. Search does not introduce a new environment variable or special limit.

### Player search dependency failure

A failure from Prisma or `GuideService.getSearchIndex()` before grouped search completion throws a domain-level Search_Error through the existing error handler. The player receives a generic safe error with no SQL, stack, filesystem path, account identity, full response, or raw phrase. No Search_Analytics_Event is attempted because no Executed_Search completed.

### Search_Persistence_Failure and Telemetry_Fail_Open

Analytics persistence is deliberately isolated after the player response is computable. The eligible completed request makes exactly one `SearchAnalyticsStore.create()` attempt. If that attempt fails, no Search_Analytics_Event row exists, no retry or duplicate attempt is made, and the unchanged Search_Response is still returned. The boundary logs only a safe diagnostic containing operation code, event timestamp, server-known season/cycle if available, user ID, and result counts; it never logs Search_Query, Normalized_Search_Phrase, the transport `q`, a full response, or an authentication token. The Admin_Search_Analytics_Resource exposes a typed incomplete-telemetry limitation such as `analyticsDataIncomplete` for the affected report scope. No analytics attempt is made when source search fails, or for short, malformed, over-length, unauthenticated, rate-limited, keystroke, Recent_Search_History, result-selection, or selected-category activity.

### Admin report failure

Admin report query failures return the existing admin-safe error envelope without SQL, stack, raw Prisma payloads, or phrases outside authorized report fields. The Admin_Search_Analytics_Page preserves the selected filter, displays a retry control, and does not expose stale data as current unless it is explicitly marked as cached/limited.

### Client cancellation and stale responses

Each eligible request receives an AbortController and generation number. Aborted or obsolete responses and errors are ignored. Only the latest generation may change Search_State or Search_Response. Retry reuses the current Normalized_Query and does not create a second history entry unless the user submits/selects it again.

### Browser-local storage failure

Every history read, parse, write, and remove is guarded. Unavailable storage, malformed JSON, non-string entries, whitespace-only values, duplicates, and over-length entries are treated as invalid history, not Search_Error. Current-query search continues and no history operation reaches the backend or analytics store.

### Route and destination failure

The route builder rejects invalid result references and never falls back to raw Search_Query, label, username, or arbitrary route. A valid result whose destination is deleted or inaccessible is handled by the existing destination page’s not-found/access behavior. Search adds no metadata to that response and performs no click tracking.

### Logging and phrase protection

The API transport query is necessary only at the Search_Endpoint boundary. `safeRequestPath` removes its query string from request, validation, rate-limit, and error logs, and analytics diagnostics use only safe operational fields. Raw Search_Query and Normalized_Search_Phrase are never copied into browser navigation URLs, redirects, result Target_Route values, player responses, ordinary application logs, or general `audit_logs` payloads. A legitimate pre-existing result display label that equals or contains the query is permitted because it is source content, not query propagation. Admin phrase summaries are available only after `requireAdmin` and only through the bounded Admin_Search_Analytics_Resource.

### Season_Rollover retention failure

The history purge treats `search_analytics_events` as a required active-season table. A failed purge is observable and prevents the rollover from claiming complete purge success under the existing rollover error path; no cross-season archive fallback is created. The report service also filters by active `seasonNumber`, so stale rows cannot be reported as current if a cleanup is incomplete.

## Testing Strategy

The implementation uses complementary unit, property, PostgreSQL integration, component, route-layout, and Playwright tests. PBT covers pure code and mocked persistence only. Every new backend test is assigned to exactly one tier by `app/backend/jest.tiers.js`; database/supertest suites are Integration_Tier, pure source tests are Unit_Tier, and no search test is advisory or excluded without a documented cause and expiry.

### Backend unit and property tests

Add:

- `app/backend/src/services/search/__tests__/searchRanking.test.ts` — normalization, exact/prefix/substring examples, guide max-rank, no-fuzzy examples, deterministic tie-breaks, and limit examples.
- `app/backend/src/services/search/__tests__/searchRanking.property.test.ts` — Properties 1–5, minimum 100 fast-check runs each.
- `app/backend/src/services/search/__tests__/searchReferenceBuilder.test.ts` — allow-list shaping, nullable stable subtitle, approved route fields, and forbidden-field examples.
- `app/backend/src/services/search/__tests__/searchReferenceBuilder.property.test.ts` — Properties 6–8 with generated private/extra fields and invalid identities.
- `app/backend/src/services/search/__tests__/searchHistory.property.test.ts` — Properties 9–10 using pure history functions and no browser/network.
- `app/backend/src/services/search/__tests__/searchService.test.ts` — short-query source conservation, all three source orchestration, grouped bounds, dependency errors, and response isolation.
- `app/backend/src/services/search/__tests__/searchAnalytics.property.test.ts` — Properties 13–16 using an in-memory mocked Search_Analytics_Store and generated execution outcomes; assert one attempt per eligible completed search, one row only on persistence success, no row/no retry on failure, unchanged Search_Response, typed incomplete-telemetry limitation, no-attempt exclusions, safe event fields, report aggregation, and active-season/admin boundaries without external services.
- `app/backend/src/services/search/__tests__/searchAnalyticsStore.test.ts` — exactly-once attempt orchestration, event field construction, no audit-log fallback, no-row/no-retry failure behavior, fail-open response isolation, typed limitation signaling, and phrase-free safe diagnostics.

The backend property tests use `fc.string()`/structured arbitraries for names and queries and explicitly avoid invalid `NaN`/infinity generators where numeric report values are generated.

### Backend integration tests

Add `app/backend/src/routes/__tests__/search.integration.test.ts` to the database-dependent tier and `app/backend/src/routes/__tests__/adminSearchAnalytics.integration.test.ts` to the same tier. Use a listening server per file for supertest. Cover:

- unauthenticated behavior, authenticated one-request three-group response, source scope, generated/test stable inclusion, nullable stable names, and guide-index results;
- strict unknown/repeated/missing/non-string/short/over-length query behavior and no-source/no-attempt/no-event assertions;
- parameterized quotes/SQL-like input, query-free request/error/rate-limit diagnostics, and no phrase propagation into navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads (while allowing coincidental existing result labels);
- global/per-user rate limiting and no-attempt/no-event rejection;
- exactly one Search_Analytics_Store write attempt per eligible completed search including zero results, exactly one row on persistence success, no row/no retry or duplicate attempt on persistence failure, captured server fields, unchanged Search_Response under Telemetry_Fail_Open, and a typed incomplete-telemetry limitation;
- owner/non-owner destination safety and approved route references;
- non-admin denial, admin report filters/trends/aggregates, phrase and category metrics, bounded pagination, and no raw payload leakage;
- active-season-only report scope and `Season_Rollover` deletion of `search_analytics_events` with no archive row.

### Frontend unit/component and route-layout tests

Add:

- `app/frontend/src/components/search/__tests__/SearchPalette.test.tsx` — trigger, visible scope text, Cmd/Ctrl+K, focus, Escape, Tab trap, arrows, Enter, result groups, history, clear, loading/error/empty/too-short/retry, close-before-navigation, and no command actions.
- `app/frontend/src/components/search/__tests__/SearchPalette.property.test.tsx` — Properties 11–12 with fake timers and out-of-order mocked responses, minimum 100 runs.
- `app/frontend/src/utils/__tests__/searchHistory.test.ts` and `searchHistory.property.test.ts` — localStorage success/failure/malformed input, bound, order, duplicate movement, and clear.
- `app/frontend/src/utils/__tests__/searchRoutes.property.test.ts` — Property 8 and invalid result identity rejection.
- `app/frontend/src/components/__tests__/Navigation.search.test.tsx` — desktop labelled Search control, visible shortcut hint, mobile fixed-header icon/button, and absence from bottom navigation/More drawer.
- `app/frontend/src/components/layout/__tests__/PlayerShell.test.tsx` — exactly one Navigation and Search_Palette around loading/error/not-found content and no shell for excluded routes.
- `app/frontend/src/pages/admin/__tests__/SearchAnalyticsPage.test.tsx` and `SearchAnalyticsPage.mobile.test.tsx` — admin report states, filters, pagination, limitation display, stacked mobile layout, no overflow, and 44px controls.

All API calls are mocked through typed helpers. Tests assert there is only one player `/api/search` request path, no guide second endpoint, no history in request parameters, no analytics on the player response, no Search_Analytics_Store activity for keystrokes/history/selections/categories, and no player exposure of Admin_Search_Analytics_Resource. Analytics persistence failure is tested as response-preserving Telemetry_Fail_Open behavior rather than a client-visible Search_Error.

### Playwright tests

Add `app/frontend/tests/e2e/universal-search.spec.ts` for authenticated desktop and mobile flows at 320, 375, 768, 1023, 1024, and 1920px. The blocking suite verifies:

- Global_Header placement, visible desktop `Search` plus `⌘ K`/`Ctrl K`, visible mobile fixed-header search control, and absence from bottom navigation/More drawer;
- Player_Shell availability through lazy loading, error, and not-found states, one Navigation/palette mount, and exclusion of onboarding, login/register/front-page, and admin routes;
- visible `Search robots, stables, or guide articles` scope text, keyboard/pointer/touch opening, focus trap/restoration, Escape, arrows, Enter, clickable results, history/clear/retry, and destination navigation;
- mobile vertical scrolling, desktop bounded overlay/current-page visibility, `scrollWidth <= clientWidth`, and 44px activation regions;
- Admin_Search_Analytics_Page authorization, active-season report presentation, stacked sections, pagination, phrase/category visibility only to admins, no horizontal overflow, and 44px controls.

### Blocking validation commands

The targeted design verification will use the project’s blocking commands after implementation:

```text
cd app/backend && pnpm run test:unit -- search && pnpm run build && pnpm run typecheck:tests
cd app/backend && pnpm run test:integration -- search
cd app/backend && pnpm run test:tiers:verify
cd app/frontend && pnpm test -- --run search && pnpm run lint && pnpm run build
cd app/frontend && pnpm exec playwright test tests/e2e/universal-search.spec.ts
```

The full project gates remain required before release. No search test or workflow step may use `continue-on-error`, `|| true`, an unguarded output pipe, or an undocumented test exclusion.

## Documentation Impact

The implementation must update or create the following exact documentation artefacts. These are design deliverables for the later implementation phase; this design update does not edit them.

| File | Required update |
|---|---|
| `docs/implementation_notes/UNIVERSAL_SEARCH_CONTRACT.md` | Create the endpoint/query contract, three-category scope, normalization/ranking/limits, safe DTO allow-lists, rate limits, exactly one Search_Analytics_Store write attempt per eligible completed search, exactly one row only on persistence success, no-row/no-retry Telemetry_Fail_Open behavior with typed incomplete-telemetry limitation, active-season retention, admin report API, and deferred scope. Record that `q` is transport-only at `GET /api/search?q=...`, is redacted from request/error/rate-limit logs, and is never propagated to navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads; coincidental existing result labels remain allowed. |
| `docs/prd_pages/PRD_UNIVERSAL_SEARCH.md` | Create the player surface PRD covering Global_Header/Search_Control placement, visible scope text, palette states, route layout, loading/error/not-found shell availability, keyboard/touch/focus behavior, desktop overlay, 320px–1023px mobile sheet, and destination Access_Context. |
| `docs/guides/UNIVERSAL_SEARCH_GUIDE.md` | Create the maintainer guide for Guide_Search_Index participation, safe source/DTO expansion, the one-attempt/one-row Search_Analytics_Store contract, no-row/no-retry Telemetry_Fail_Open behavior and typed incomplete-telemetry limitation, active-season purge, admin-only reporting, rate-limit/logging troubleshooting, and required tests. Explicitly state that username, fuzzy, command, click, and cross-season analytics are not MVP behavior and that raw/normalized phrases never propagate beyond authorized reporting. |
| `docs/guides/README.md` | Add `UNIVERSAL_SEARCH_GUIDE.md` under the feature guides. |
| `docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md` | Document Search_Palette overlay/sheet treatment, visible focus, restrained motion, 44px controls, and no-overflow mobile behavior. |
| `.kiro/steering/frontend-standards.md` | Document the reusable Player_Shell/Search_Palette composition, 1024px responsive behavior, mobile fixed-header search control, focus trap/restoration, and 44px touch-target conventions. |
| `.kiro/steering/frontend-state-management.md` | State that Player_Shell palette state and browser-local Recent_Search_History use local hook/component state and `localStorage`, not a Zustand store. |
| `.kiro/steering/testing-strategy.md` | Add exact search unit/property/integration/route-layout/E2E locations, analytics retention tests, and the blocking no-bypass rule for this feature. |
| `.kiro/steering/project-overview.md` | Add Universal_Search_System, Player_Shell, Search_Analytics_Store, `GET /api/search`, `GET /api/admin/search-analytics/report`, and the three-category boundary to the project overview. |
| `docs/BACKLOG.md` | After verification passes, update item #27 to state the delivered robots/stables/guide search-only palette and admin analytics scope; do not claim the broader players/weapons/pages/battle-history/commands scope. |

No guide-content maintenance rule changes are required because this feature consumes guide content without changing article claims. No new error-code documentation entry is required if existing authentication, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, and generic internal error envelopes are reused.

## Requirements Traceability Matrix

The following matrix maps every acceptance criterion in Requirements 1–12 to the design decision and verification location. `A` means Architecture, `C` Components/Interfaces, `D` Data Models, `P` Correctness Properties, `E` Error Handling, `T` Testing Strategy, and `Doc` Documentation Impact.

### Requirement 1 — Provide the Authenticated MVP Search Contract

| Criterion | Design coverage | Verification |
|---|---|---|
| 1.1 | A/C: `app/backend/src/routes/search.ts` exposes authenticated `GET /api/search`. | Search route integration test. |
| 1.2 | A/C: Search_Response always contains `robots`, `stables`, and `guide` groups. | Grouped-response integration test; Property 2. |
| 1.3 | A/D: robot adapter matches only `Robot.name`. | Source selector test; Property 2. |
| 1.4 | A/D: stable adapter trims and matches only non-empty `User.stableName`. | Nullable-name integration test; Property 7. |
| 1.5 | A/C: guide adapter consumes only `GuideService.getSearchIndex()`. | Service mock/orchestration test. |
| 1.6 | A/D: no `isGenerated` exclusion when trimmed `stableName` is non-empty. | Generated/test stable fixture; Property 7. |
| 1.7 | A/C: three-category allow-list excludes username, teams, weapons, pages/actions, and battle history. | Forbidden-scope integration test; Property 2. |
| 1.8 | A/E: `authenticateToken` precedes search and returns existing auth failure without data. | Unauthenticated integration test. |
| 1.9 | A/E: short-query branch returns three empty groups before source calls. | Property 11; mocked no-source test. |
| 1.10 | C/E: strict schema rejects Malformed_Search_Input before sources. | Validation edge tests and no-source assertions. |
| 1.11 | C/E: schema enforces 100-character trimmed maximum with existing validation response. | Length-boundary integration test. |

### Requirement 2 — Normalize, Rank and Bound Search Results

| Criterion | Design coverage | Verification |
|---|---|---|
| 2.1 | A/P: `searchRanking.ts` removes only leading/trailing whitespace. | Property 1. |
| 2.2 | A/P: lower-case comparison preserves internal whitespace and other characters. | Property 1; matcher examples. |
| 2.3 | A/P: Match_Rank order is exact, prefix, substring. | Property 3. |
| 2.4 | A/P: Guide_Result rank is max of title/description/body matches. | Property 3; guide unit test. |
| 2.5 | A/P: inclusion requires a case-insensitive substring relationship. | Property 2; no-match tests. |
| 2.6 | A/P: each Result_Group is ranked independently. | Property 3; grouped sorter test. |
| 2.7 | A/P: category-specific deterministic tie-breaks are documented. | Property 4; permutation test. |
| 2.8 | A/P: category result count is capped at 10. | Property 5; oversized-source test. |
| 2.9 | A/P: total response count is capped at 30. | Property 5; response bound assertion. |
| 2.10 | A/P: category cap is applied after rank and tie-break. | Property 5 model comparison. |
| 2.11 | A/P: groups remain independently ranked with no cross-category rank. | Property 5; group-order example. |
| 2.12 | A/P/E: no fuzzy, phonetic, edit-distance, or approximate branch exists. | Near-match unit/integration tests; Property 2. |

### Requirement 3 — Return Player-Safe References and Preserve Destination Behavior

| Criterion | Design coverage | Verification |
|---|---|---|
| 3.1 | C/D: Robot_Result allow-list contains category, id, label/name, optional non-empty stable subtitle. | Reference-builder unit/property test. |
| 3.2 | C: `searchRoutes.ts` builds `/robots/:id`; palette closes before navigation. | Component and Playwright route test. |
| 3.3 | A/E: robot destination remains responsible for Access_Context and sanitization. | Owner/non-owner integration/E2E test. |
| 3.4 | C/D: empty robot subtitle is omitted. | Reference-builder examples; Property 6. |
| 3.5 | C/D: username/account identifier is never a subtitle fallback. | Forbidden-field assertion; Property 6. |
| 3.6 | C/D: Stable_Result contains only category, userId, trimmed label, and approved route identity. | DTO allow-list test. |
| 3.7 | C/D: username and complete stable profile are excluded. | Response forbidden-key integration test. |
| 3.8 | C: stable selection builds `/stables/:userId`. | Component and Playwright route test. |
| 3.9 | D/P: null/empty/whitespace-only stable names produce no result. | Nullable-name fixture; Property 7. |
| 3.10 | A/D: `profileVisibility` remains dormant and is not a new filter. | Visibility-independence test; Property 7. |
| 3.11 | C/D: Guide_Result returns title, section context, sectionSlug, articleSlug only. | Guide DTO test. |
| 3.12 | C/D: body text and complete article content are excluded. | Response allow-list test; Property 6. |
| 3.13 | C: guide selection builds `/guide/:sectionSlug/:articleSlug`. | Component and Playwright route test. |
| 3.14 | C/D: every result is a discriminated Player_Safe_Reference. | Serializer schema/property test. |
| 3.15 | C/E: secrets, private fields, unbounded payloads, and unrelated-account data are excluded. | Security payload test; Property 6. |

### Requirement 4 — Validate and Protect the Search Endpoint

| Criterion | Design coverage | Verification |
|---|---|---|
| 4.1 | C/E: route uses existing `validateRequest` with strict `searchQuerySchema`. | Route validation integration test. |
| 4.2 | C/E: only documented `q` query key is accepted. | Unknown-key schema test. |
| 4.3 | E: unknown keys fail before source queries and before any analytics attempt. | Mocked zero-source/no-attempt test. |
| 4.4 | E: non-string/otherwise invalid q fails before source queries and before any analytics attempt. | Schema edge test. |
| 4.5 | A/P: trim occurs before length and matching, and the trimmed value is the only phrase eligible for analytics. | Property 1; length boundaries. |
| 4.6 | A: Prisma selectors/queries are parameterized and never interpolate Search_Query. | Static source review and SQL-like integration input. |
| 4.7 | A/P: both result limits apply before response serialization and before analytics counts are captured. | Property 5; oversized integration fixture. |
| 4.8 | A/C: identity comes only from `req.user.userId`, including Search_Analytics_Event identity. | Auth-context integration test. |
| 4.9 | C/E: owner/account/visibility identities supplied by input are rejected/ignored and cannot affect search or analytics identity. | Strict unknown-key/security tests. |
| 4.10 | A/C: global limiter and existing authenticated per-user limiter cover `/api/search`. | Rate-limit integration test. |
| 4.11 | E: rejected request returns safe 429 and makes no Search_Analytics_Store attempt or event. | Threshold-crossing integration test. |
| 4.12 | E: source failure returns safe Search_Error with no internals/query and makes no analytics attempt or event. | Dependency-failure test. |
| 4.13 | A/C: all three sources feed one Search_Response contract, and only a completed eligible response reaches the one-attempt analytics boundary. | Service orchestration test. |
| 4.14 | C: Search_Client uses only `/api/search` for MVP categories and never sends browser history/selection analytics requests. | Request-count/source scan test. |
| 4.15 | A/E: the eligible completed path makes exactly one Search_Analytics_Store write attempt; success creates exactly one row, failure creates no row and no retry/duplicate attempt, preserves unchanged Search_Response, and exposes a typed incomplete-telemetry limitation. The transport `q` is allowed only at `GET /api/search?q=...`; request/error/rate-limit logs redact it, and raw/normalized phrases never propagate to navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads. Existing result labels that coincidentally contain the query remain allowed. | Captured-log, response-isolation, exact-cardinality, failure/no-retry, limitation, and route-payload integration tests. |

### Requirement 5 — Provide the Search-Only Desktop and Mobile Palette

| Criterion | Design coverage | Verification |
|---|---|---|
| 5.1 | A/C: Player_Shell makes one Search_Control available through Global_Header on every post-onboarding route. | PlayerShell route-layout test; E2E route matrix. |
| 5.2 | C: desktop Navigation renders visibly labelled `Search`. | Navigation component/E2E test. |
| 5.3 | C: desktop control visibly shows `⌘ K` or `Ctrl K`. | Navigation component/E2E test. |
| 5.4 | C: mobile fixed top header renders visible search icon/button. | Mobile component/E2E test. |
| 5.5 | C: mobile control is not in bottom navigation or More drawer. | DOM/component test; E2E placement assertion. |
| 5.6 | C: Cmd+K opens/focuses/prevents default on macOS. | Keyboard component test. |
| 5.7 | C: Ctrl+K opens/focuses/prevents default elsewhere. | Keyboard component test. |
| 5.8 | A/C: visible Search_Control independently discovers the palette. | Desktop/mobile discovery test. |
| 5.9 | C: open palette displays `Search robots, stables, or guide articles`. | Palette component/E2E test. |
| 5.10 | C: palette contains only results and Recent_Search_History. | Scope/component test. |
| 5.11 | C: no command/page/navigation action execution exists. | Component/source assertion. |
| 5.12 | C: trigger opens in place without navigation. | Trigger test. |
| 5.13 | C: 200ms debounce restarts after each change. | Fake-timer component test. |
| 5.14 | A/C: request-generation guard ignores late earlier responses. | Property 12. |
| 5.15 | C/P: short query makes no request and shows too-short/history. | Property 11; palette test. |
| 5.16 | C: groups render in fixed category order. | Group-order component test. |
| 5.17 | C: every result is clickable and keyboard-operable. | Result-list/E2E activation tests. |
| 5.18 | C: selection stores/close state precedes route navigation. | Selection sequencing test. |
| 5.19 | A/C: mobile 320px–1023px palette is vertical, scrollable, and overflow-free. | Playwright viewport matrix. |
| 5.20 | A/C: desktop 1024px+ palette is bounded and leaves current page visible. | Playwright desktop test. |

### Requirement 6 — Store and Use Browser-Local Recent Searches

| Criterion | Design coverage | Verification |
|---|---|---|
| 6.1 | C: empty query shows history when values exist. | Seeded-history component test. |
| 6.2 | C: non-empty history renders Clear_History_Control. | Accessible control test. |
| 6.3 | C/D: submit/result selection stores normalized query locally. | Property 9; storage/network test. |
| 6.4 | C/D: history retains at most five unique values. | Property 9. |
| 6.5 | C/D: newest value is first. | Property 9. |
| 6.6 | C/D: case-insensitive duplicate moves to newest position once. | Property 9. |
| 6.7 | C: history selection populates input and follows normal short-query behavior. | History interaction test. |
| 6.8 | C: clear removes all current-browser history. | Clear-history test. |
| 6.9 | C: clear presents empty-history state. | Clear-history test. |
| 6.10 | D: history exists only in current browser localStorage. | Browser storage smoke test. |
| 6.11 | A/C: history/account identity/mutation are never sent to Search_Backend. | Network interception test. |
| 6.12 | D/P: invalid stored types/blank/over-length values are discarded while valid values remain. | Property 10. |
| 6.13 | E: unavailable storage does not block current-query search. | Storage-throw test. |
| 6.14 | E: malformed storage does not become Search_Error. | Malformed-storage test. |

### Requirement 7 — Present Complete Search States and Accessible Interaction

| Criterion | Design coverage | Verification |
|---|---|---|
| 7.1 | C: pending request renders loading Search_State. | Palette component test. |
| 7.2 | C/P: late earlier response cannot replace current query. | Property 12. |
| 7.3 | C: zero matches render category-aware empty Search_State without internals. | Empty-state test. |
| 7.4 | C/E: failed endpoint renders Search_Error and retry control. | Error/retry test. |
| 7.5 | C/E: retry preserves current Normalized_Query. | Error/retry test. |
| 7.6 | C: open moves focus to query input. | Focus lifecycle test. |
| 7.7 | C: dialog has accessible name and dialog/list semantics. | Accessibility DOM test. |
| 7.8 | C: focus remains within active palette until dismissal. | Focus-trap test/E2E. |
| 7.9 | C: Arrow keys visibly move through Accessible_Result_List. | Keyboard result-list test. |
| 7.10 | C: Tab remains among palette controls. | Focus-trap test. |
| 7.11 | C: Enter selects focused result. | Keyboard activation test/E2E. |
| 7.12 | C: Escape dismisses. | Keyboard dismissal test. |
| 7.13 | C: dismissal restores opening Search_Control focus when available. | Focus restoration test/E2E. |
| 7.14 | A/C: trigger, clear, retry, and results have 44px minimum activation regions. | Playwright geometry test. |
| 7.15 | A/C: visible focus indicators and readable category labels follow frontend standards. | DOM/class/browser assertions. |
| 7.16 | C: accessible names distinguish groups, history, clear, retry, and dismiss controls. | RTL accessibility assertions. |
| 7.17 | A/C: palette has no horizontal overflow at all specified widths. | Playwright viewport matrix. |

### Requirement 8 — Preserve Search and Destination Route Semantics

| Criterion | Design coverage | Verification |
|---|---|---|
| 8.1 | C: robot route builder uses validated id only. | Property 8. |
| 8.2 | C: raw Search_Query cannot become robot route. | Property 8 with query decoys. |
| 8.3 | C: stable route builder uses validated userId only. | Property 8. |
| 8.4 | C: username is never used for stable route. | Property 8 and forbidden-field test. |
| 8.5 | C: guide route builder validates section/article slugs. | Property 8. |
| 8.6 | A/E: destination page handles deleted/denied result under existing behavior. | Destination integration/E2E test. |
| 8.7 | E: destination failure reveals no extra search metadata. | Failure-navigation test. |
| 8.8 | C/D: backend emits only identities representable by approved routes. | Properties 6 and 8. |

### Requirement 9 — Test the Feature as a Blocking Contract

| Criterion | Design coverage | Verification |
|---|---|---|
| 9.1 | T: backend unit/property files cover normalization, rank, limits, no-fuzzy, malformed input, and shaping. | Targeted unit command and tier verification. |
| 9.2 | T: backend Integration_Tier covers auth, groups, access safety, names, generated/test stables, guide, limits, rate limiting, and route references. | `search.integration.test.ts`. |
| 9.3 | T: frontend tests cover trigger, shortcut, debounce, stale response, groups, history, clear, and all states. | SearchPalette/Navigation test files. |
| 9.4 | T: Playwright covers desktop/mobile, shell placement, scope text, focus, touch, routes, targets, and overflow. | `universal-search.spec.ts`. |
| 9.5 | T/P: fast-check properties generate varied pure inputs without external calls, including matching, shaping, history, route, mocked request-generation, analytics attempt/cardinality, and report aggregation behavior. | Properties 1–16; source dependency review. |
| 9.6 | T: all search tests are blocking and have no bypass/exclusion. | CI scan and `test:tiers:verify`. |
| 9.7 | T: backend and Admin_Portal suites verify exactly one write attempt per eligible completed search, exactly one row on persistence success, no row/no retry or duplicate attempt on persistence failure, unchanged Search_Response, typed incomplete-telemetry limitation, captured fields, no-event exclusions, phrase redaction/non-propagation, active-season behavior, admin authorization, report metrics, and bounded pagination. | `searchAnalytics.property.test.ts`, `search.integration.test.ts`, and `adminSearchAnalytics.integration.test.ts`. |
| 9.8 | T: frontend and browser suites verify history remains browser-local, result/category selections create no analytics, Search_Response is unchanged by analytics failure, Admin_Search_Analytics_Resource is absent from player surfaces, and mobile admin layout remains accessible and overflow-free. | SearchPalette tests, `SearchAnalyticsPage` tests, and `universal-search.spec.ts`. |
| 9.9 | T/E: every search check is blocking and cannot pass while search, access, limits, privacy, or analytics assertions fail; no `continue-on-error`, `|| true`, unguarded output pipe, or undocumented exclusion is permitted. | Workflow/static scan and full targeted validation commands. |

### Requirement 10 — Document the Implemented Search Contract

| Criterion | Design coverage | Verification |
|---|---|---|
| 10.1 | Doc: implementation contract names categories, fields, normalization, rank, limits, debounce, and no-fuzzy boundary. | `UNIVERSAL_SEARCH_CONTRACT.md` review/grep. |
| 10.2 | Doc: contract records username exclusion, generated/test inclusion, null/cleared names, dormant visibility. | Contract/guide documentation test. |
| 10.3 | Doc: contract records one endpoint, `q` transport-only boundary, safe DTO, auth/rate-limit behavior, redacted request/error/rate-limit logs, approved routes, Access_Context, and prohibition on phrase propagation to navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads, while allowing coincidental existing result labels. | Contract grep/review and phrase-boundary scan. |
| 10.4 | Doc: PRD/guide records local five-item history, clear, shortcuts, mobile, focus, and accessibility. | Documentation review. |
| 10.5 | Doc: guide identifies Guide_Search_Index, routes, and every deferred category/action. | Guide content review. |
| 10.6 | Doc: contract and guide record exactly one Search_Analytics_Store write attempt per eligible completed search, exactly one row on persistence success, no row/no retry or duplicate attempt on persistence failure, unchanged Search_Response under Telemetry_Fail_Open, typed incomplete-telemetry limitation, captured fields, no-attempt exclusions, admin-only reporting, and active-season retention/purge. | Analytics contract/guide review and implementation grep. |
| 10.7 | Doc: backlog item #27 is updated only after verification and states delivered MVP, not broad backlog scope. | Backlog diff and final verification. |

### Requirement 11 — Provide Shared Post-Onboarding Shell Availability

| Criterion | Design coverage | Verification |
|---|---|---|
| 11.1 | A/C: Player_Shell renders exactly one Navigation and one Search_Palette around all post-onboarding routes. | Route-layout test and E2E route matrix. |
| 11.2 | A/C: shell wraps loading content and keeps Global_Header/palette mounted. | Suspense/loading route test. |
| 11.3 | A/C: shell wraps error content and keeps Global_Header/palette mounted. | Error-state route test. |
| 11.4 | A/C: shell wraps not-found content and keeps Global_Header/palette mounted. | Catch-all/not-found route test. |
| 11.5 | A/C: onboarding, auth/front-page, `/admin`, and admin descendants are outside shell. | Exclusion route matrix. |
| 11.6 | A/C: page-by-page Navigation imports are removed from shell-managed composition. | Route/source scan and one-mount assertion. |

### Requirement 12 — Measure Search Usage Through Admin-Only Analytics

| Criterion | Design coverage | Verification |
|---|---|---|
| 12.1 | A/C/D/E: after validation and request protection, each eligible completed authenticated search, including zero results, performs exactly one Search_Analytics_Store write attempt; success creates exactly one row, failure creates no row and no retry/duplicate attempt, preserves unchanged Search_Response, and exposes a typed incomplete-telemetry limitation under Telemetry_Fail_Open. | Store cardinality/failure integration test; Property 13. |
| 12.2 | E/P: short query exits before the analytics boundary and makes no attempt or event. | Short-query integration test; Property 13. |
| 12.3 | E/P: malformed/over-length input is rejected before source search and analytics, with no attempt or event. | Validation integration test; Property 13. |
| 12.4 | E/P: authentication precedes search and analytics, so unauthenticated requests make no attempt or event. | Auth integration test; Property 13. |
| 12.5 | E/P: request-protection rejection returns safe 429 and makes no attempt or event. | Rate-limit integration test; Property 13. |
| 12.6 | E/P: failed source search does not complete an Executed_Search and makes no attempt or event. | Dependency-failure integration test; Property 13. |
| 12.7 | A/C/D: Search_Analytics_Store is called only once for completed eligible executions; no event row is synthesized for excluded or failed requests. | Store integration test; Property 13. |
| 12.8 | A/C/D: keystrokes, browser-local Recent_Search_History operations, result selections, and selected categories never call the analytics store and create no event. | Frontend network test and mocked-store integration test; Property 13. |
| 12.9 | D: successful event construction captures authenticated user identity, server Active_Season_Context, and server-generated timestamp. | Database field assertion; Property 14. |
| 12.10 | D: successful event construction captures exact phrase, three category counts, total count, and no-result status. | Database field assertion; Property 14. |
| 12.11 | A/E: analytics is attempted only after Search_Response construction, and persistence failure cannot mutate or append fields to that response. | Before/after response equality test; Properties 13–14. |
| 12.12 | A/E: Search_Analytics_Event values and raw phrases are unavailable to players; only authorized Admin_Search_Analytics_Resource reporting can expose phrase summaries. | Player endpoint authorization/payload test. |
| 12.13 | A/E: `q` is allowed only in `GET /api/search?q=...` transport; request/error/rate-limit logs redact it, and raw/normalized phrases never enter application navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads. Coincidental pre-existing result labels remain allowed. | Captured-log, route-payload, response, and audit-boundary tests; Properties 13–14. |
| 12.14 | C: Admin_Portal provides `/admin/search-analytics` and its protected API resource. | Admin route/page integration and E2E tests. |
| 12.15 | C/D: authorized report provides total searches, unique searchers, and active-season/cycle trends from persisted events. | Report aggregation test; Property 15. |
| 12.16 | C/D: authorized report provides top phrases, no-result phrases, and category usage from persisted events. | Report aggregation test; Property 15. |
| 12.17 | C/D: detailed report provides safe bounded/paginated per-player/stable analysis and a typed incomplete-telemetry limitation when applicable. | Pagination/allow-list/limitation integration test; Property 15. |
| 12.18 | E: non-admin receives existing admin authorization failure with no analytics data. | Admin authorization integration/E2E test. |
| 12.19 | A/D: raw events are retained only for active season, report queries are active-season scoped, and no cross-season archive exists. | Active-season query/persistence test; Property 16. |
| 12.20 | A/D: `Season_Rollover` purges `search_analytics_events` and creates no archive row. | Rollover integration test against `purgeHistory()`; Property 16. |
| 12.21 | C: Admin_Search_Analytics_Page stacks report sections and controls below 1024px, preserves 44px controls, and has no horizontal overflow from 320px through 1023px. | Mobile component and Playwright viewport tests. |

## Design completion note

This document updates the design only. It does not create `tasks.md`, modify `.config.kiro`, change `app/` application code, create a Prisma migration, or claim that implementation/tests have passed. The later implementation phase must preserve the exact domain concepts, code artefact names, route boundaries, analytics fail-open limitation, active-season purge rule, mobile constraints, and traceability above. If implementation reveals a requirement ambiguity, return to requirements clarification before creating tasks.
