# Universal Search Guide

## Overview

Universal Search is the authenticated player search surface for the three MVP categories:

- robots, matched by `Robot.name`;
- stables, matched by a trimmed, non-empty `User.stableName`; and
- guide articles, matched through the existing `GuideService.getSearchIndex()` / **Guide_Search_Index**.

The player experience is one search-only palette, one backend request, and one bounded response. Search returns safe references for navigation; it does not return complete robot, user, or guide records. Destination pages continue to own authorization, not-found handling, and sanitization.

The feature is implemented across `app/backend/src/services/search/`, `app/backend/src/routes/search.ts`, `app/frontend/src/components/search/`, and the shared player route layout in `app/frontend/src/components/layout/PlayerShell.tsx`.

## Contract at a glance

### One endpoint

The player client calls only:

```text
GET /api/search?q=<query>
```

The endpoint is authenticated and uses the existing general API limiter plus the existing authenticated per-user limiter. The request schema accepts exactly `q`; missing, repeated, non-string, unknown-key, and over-length input is rejected with the existing player-safe validation boundary.

Normalization removes only leading and trailing whitespace. Internal whitespace and all other characters remain significant. A trimmed query shorter than two characters returns the fixed empty response without querying robots, stables, or the guide index. A trimmed query longer than 100 characters is invalid.

The response always has this shape and order:

```json
{
  "robots": [],
  "stables": [],
  "guide": []
}
```

The groups are independently ranked and limited to 10 results each. The response-wide bound is 30 results. There is no cross-category ranking: a robot result does not displace a stable or guide result based on a shared score.

### Matching and ranking

Matching is case-insensitive substring matching. A matching value receives one of these ranks, in this order:

1. exact — the whole searchable value equals the normalized query;
2. prefix — the searchable value starts with the normalized query but is not exact; or
3. substring — the normalized query occurs elsewhere in the searchable value.

Guide results use the strongest rank from the guide title, description, or body text. The body and description are search-only inputs; they are not copied into the player response.

Ties are deterministic and independent of database return order:

- robots: lower-case name, then numeric robot `id`;
- stables: lower-case trimmed stable name, then numeric user `id`; and
- guides: lower-case title, then `sectionSlug`, then article slug.

The pure ranking oracle is `app/backend/src/services/search/searchRanking.ts`. Do not add fuzzy, phonetic, edit-distance, or approximate matching to the existing ranking functions.

## Source and DTO allow-lists

Universal Search has two separate allow-lists: the source fields that the backend reads, and the DTO fields that the player may receive. Both must remain narrow.

### Approved source fields

`SearchService` selects only these values:

| Source | Approved fields | Searchable values |
|---|---|---|
| Robot | `id`, `name`, related `user.stableName` | `name` only |
| Stable | `id`, `stableName` | trimmed, non-empty `stableName` only |
| Guide index | `slug`, `title`, `sectionSlug`, `sectionTitle`, `description`, `bodyText` | `title`, `description`, and `bodyText` |

Stable matching does not use `username`, `profileVisibility`, or the generated-account flag. Named generated and test stables participate normally. A null, empty, or whitespace-only `stableName` is not a stable result and cannot fall back to `username`.

The source types are in `app/backend/src/services/search/searchTypes.ts`. Database selection and source orchestration are in `searchService.ts`; result shaping is in `searchReferenceBuilder.ts`.

### Approved player DTO fields

The backend and frontend DTOs intentionally contain only route identity and display fields:

| Result | Fields |
|---|---|
| Robot | `category: 'robots'`, numeric `id`, `label`, optional trimmed `subtitle` |
| Stable | `category: 'stables'`, numeric `userId`, `label` |
| Guide | `category: 'guide'`, `title`, `sectionTitle`, `sectionSlug`, `articleSlug` |

The frontend union is `app/frontend/src/utils/searchTypes.ts`; the backend union is `app/backend/src/services/search/searchTypes.ts`. Never spread a Prisma record into a response. In particular, do not return usernames, passwords, profile fields, article `bodyText`, `description`, arbitrary route strings, or analytics fields.

The client constructs only these routes from validated identity fields:

```text
robots  -> /robots/:id
stables -> /stables/:userId
guide   -> /guide/:sectionSlug/:articleSlug
```

`app/frontend/src/utils/searchRoutes.ts` rejects non-positive or unsafe identities and slugs. Labels and query text are never route segments.

### Expanding a source or DTO allow-list

Adding a category or field is a contract change, not a convenience edit. Update all of the following together:

1. the requirements/design contract and this guide;
2. backend source types and the Prisma `select`/Guide_Search_Index adapter;
3. the ranking and result-reference builder, including deterministic tie-breaking;
4. the fixed `SearchResponse` groups and category/total bounds;
5. frontend safe DTO types and route construction;
6. palette/result rendering and access-preserving destination behavior; and
7. unit, property, integration, frontend, and E2E assertions, plus the test-tier classification if database access is introduced.

Keep the client and server allow-lists explicit even when the new source record has more fields available. A source field may be used for matching without becoming a response field, as with guide `description` and `bodyText`.

## Guide_Search_Index participation

The guide category is deliberately integrated into the same search request rather than implemented as a second client request.

- `SearchService` obtains the existing index from `guideService.getSearchIndex()`.
- The index is the authoritative guide search source; do not create a second filesystem parser or duplicate guide index.
- `title`, `description`, and `bodyText` participate in case-insensitive matching.
- `sectionTitle` supplies display context and `sectionSlug` plus `slug` supply the approved route identity.
- `buildGuideSearchResult()` returns title, section title, section slug, and article slug only.
- The article body and description never cross the player DTO boundary.

The client does not call `/api/guide/search-index` for Universal Search. If a guide article is missing, first check that the article is present in the existing guide content/index and that its title, description, or body contains the normalized query. Then check the guide result allow-list and safe route builder.

## PlayerShell, Global Header, and palette placement

`PlayerShell` is the single composition boundary for post-onboarding player routes. It renders exactly one:

- `Navigation`, the existing Global Header;
- `SearchPalette`; and
- route `Outlet`.

The shell owns the search controller (`useSearchPalette`) and passes the open/select callbacks into the header and result list. The `Suspense` loading fallback, route error boundary, and player not-found view are inside the shell, so the header and search entry point remain available while page content loads, fails, or is not found.

The following routes are intentionally outside the player shell and do not receive the player search palette:

- `/onboarding`;
- `/`, `/login`, `/register`, and other front-page/auth routes; and
- `/admin` and all admin descendants.

Do not reintroduce page-by-page `Navigation` imports for shell-managed pages. Duplicate headers or palettes break focus restoration, route loading behavior, and the one-request composition model.

### Header controls

`Navigation.tsx` remains the Global Header:

- at viewports at or above the 1024px desktop breakpoint, the fixed top navbar contains a visibly labelled `Search` control and visible `⌘ K`/`Ctrl K` shortcut hint;
- below 1024px, the fixed mobile top header contains a visible search icon/button; and
- the mobile search control is not in bottom navigation and not in the `More` drawer.

Cmd+K on macOS and Ctrl+K on other platforms are accelerators, never the only discovery mechanism. The visible control must remain usable with a pointer, touch, keyboard focus, or assistive technology. The open palette states its scope with `Search robots, stables, or guide articles`.

## Browser-local recent history

Recent searches are a browser convenience, not a server feature.

- Storage key: `armoured-souls:recent-searches`.
- Maximum entries: five.
- Ordering: newest first.
- Uniqueness: case-insensitive.
- Values: trimmed, non-empty strings no longer than 100 characters.
- Storage: the current browser's `localStorage` only.

`app/frontend/src/utils/searchHistory.ts` sanitizes reads and writes. Malformed JSON, invalid entries, unavailable storage, quota errors, and privacy-mode failures degrade to empty or in-memory history; they must not prevent the current search from working.

A normalized query is remembered when the player submits it or selects a result. Selecting a recent query only puts it back into the input and follows the normal short-query and 200ms debounce behavior. Clear history removes the browser value and in-memory list. History reads, writes, clearing, keystrokes, and result selection do not send a history payload, create a search analytics event, or call a history endpoint.

## Analytics and administration boundaries

### `SearchAnalyticsStore`

Search analytics is measurement-only and separate from the player response and from `audit_logs`.

For every eligible authenticated completed search, including a completed search with zero results, the backend makes exactly one write attempt to the dedicated `SearchAnalyticsStore`. A successful attempt creates one `Search_Analytics_Event` in `search_analytics_events` with server-owned values:

- authenticated `userId`;
- active server-resolved season and cycle;
- server-generated event timestamp;
- exact normalized phrase;
- robot, stable, guide, and total result counts; and
- `noResult` derived from the total count.

The store is a write boundary. It does not return raw event rows, write an `AuditLog` fallback, reconstruct values from another table, or accept browser-supplied identity, history, selection, category, or timestamp data. The server-generated `eventTimestamp` is supplied by `searchAnalyticsService.ts`, not by the browser. The implementation is split between:

- `searchAnalyticsTypes.ts` — typed event and report shapes;
- `searchAnalyticsStore.ts` — one persistence adapter;
- `searchAnalyticsService.ts` — eligibility and fail-open orchestration; and
- `searchAnalyticsDiagnostics.ts` — phrase-free operational diagnostics.

Short, malformed, over-length, unauthenticated, rate-limited, and source-failed requests are not completed eligible searches and create no analytics attempt or event.

### Admin_Search_Analytics_Resource

Authorized administrators use the separate Admin Portal page at `/admin/search-analytics`, backed by:

```text
GET /api/admin/search-analytics/report
```

The route uses the existing authentication and `requireAdmin` boundary plus strict query validation. It accepts bounded `cycleFrom`, `cycleTo`, `page`, and `limit` filters; the active season is always resolved on the server. The report is aggregate and bounded, not a raw event export. It includes:

- active-season and cycle period;
- total searches, unique searchers, and no-result searches;
- per-cycle trends;
- bounded top phrases and no-result phrases;
- category usage totals; and
- deterministic, paginated player/stable aggregate analysis.

Raw event IDs, event payloads, passwords, tokens, and unbounded event rows are not exposed. The player Search_Palette never displays analytics. The Admin Portal remains outside `PlayerShell` and has its own sidebar/layout boundary.

The report can contain the typed limitation `{ code: 'analyticsDataIncomplete', ... }` when a fail-open persistence failure was observed for the requested scope. This limitation describes incomplete telemetry; it does not synthesize a missing event or trigger a retry.

## Query transport and log redaction

`q` is necessarily present in the transport URL because the endpoint is a GET request:

```text
/api/search?q=...
```

That transport occurrence is permitted. It is not permission to copy the query elsewhere.

The raw query and normalized phrase must not appear in:

- request, error, or rate-limit log messages;
- ordinary application logs or general `audit_logs` payloads;
- redirects, navigation URLs, or generated `Target_Route` values; or
- player responses, search DTOs, or error text.

`app/backend/src/utils/safeRequestPath.ts` reduces the exact search endpoint to `/api/search` before ordinary diagnostics use the request path. Fail-open analytics diagnostics use an explicit safe allow-list: operation code, server timestamp/context, authenticated user ID, and result counts. They do not serialize the request URL, query, database error text, token, or full response.

A legitimate pre-existing result label that happens to contain the query is still valid display content. The rule is against query echo/propagation, not against changing a result label's existing text.

## Fail-open and no-retry behavior

Search response delivery is independent of analytics persistence:

1. authenticate, protect, validate, search, rank, shape, and bound the response;
2. make one analytics write attempt for an eligible completed search;
3. if the write succeeds, retain one event and return the response unchanged;
4. if the write fails, retain no event, make no retry or duplicate attempt, record only safe diagnostics, expose the typed admin limitation, and return the same successful response unchanged.

Do not add a retry loop, queue, `audit_logs` fallback, client-side telemetry retry, or analytics fields to `SearchResponse`. A persistence failure is not a player search failure. Conversely, a source-search failure is not eligible for fail-open analytics: it follows the existing player-safe search error boundary and creates no event.

## Active-season retention and rollover purge

`Search_Analytics_Event` rows are active-season operational data. The report always resolves and filters the current season on the server, and future-cycle rows are excluded from report results. The MVP has no cross-season search analytics archive.

`app/backend/src/services/season/seasonPurgeService.ts` includes `search_analytics_events` in its fixed Stage 3 history purge list. Season rollover counts and purges the table with the other active-season operational history and reports the deleted count. Do not copy search events into an archive table or preserve phrase history across rollover. If the required purge fails, rollover must retain its existing failure behavior rather than reporting a complete purge.

## Mobile and accessibility behavior

The search surface is mobile-first and must work from 320px through 1023px without horizontal overflow.

- Desktop (at least 1024px): bounded overlay; the current page remains visible behind it.
- Mobile (320–1023px): vertically ordered sheet anchored from the bottom; content is internally scrollable and widths remain bounded.
- Search, close, retry, clear-history, result, and pagination controls have at least 44px activation regions.
- The palette is a modal dialog with an accessible name and visible scope description.
- Opening focuses the search input; Escape closes; focus is trapped within the dialog while open and restored to the opening control when it remains connected.
- Results are grouped as Robots, Stables, and Guide articles in that order, with listbox/group semantics and visible focus.
- Pointer/touch activation and keyboard activation are both supported. Arrow Up/Down moves through results, Enter activates the focused result, Tab/Shift+Tab remain inside the dialog, and the result closes before navigation.
- Loading, recent-history, too-short, empty, and player-safe error states are explicit. Retry preserves the current normalized query.
- The client waits 200ms after the latest eligible input change and uses cancellation plus a request-generation guard so stale responses cannot replace newer results.

The responsive reference pattern is the existing frontend standards guidance in `.kiro/steering/frontend-standards.md`. Verify 320px, 375px, 768px, 1023px, 1024px, and 1920px when changing layout or touch targets.

## Tests and tier assignment

Run these commands from the relevant package directories; this guide records the checks to run, not a claim that they have already passed.

### Backend focused checks

```bash
cd app/backend
pnpm run test:unit -- search
pnpm run test:integration -- search
pnpm run build
pnpm run typecheck:tests
pnpm run test:tiers:verify
```

Search unit/property coverage lives mainly under `src/services/search/__tests__/`, with schema coverage under `src/schemas/__tests__/search.test.ts`. The pure ranking, reference-builder, service, analytics, and diagnostic tests are unit-tier candidates. `fast-check` properties remain in the unit tier unless they use the real database.

The database/supertest route suites are explicitly integration-tier members in `app/backend/jest.tiers.js`:

- `src/routes/__tests__/search.integration.test.ts`; and
- `src/routes/__tests__/adminSearchAnalytics.integration.test.ts`.

`pnpm run test:tiers:verify` is the blocking partition check. A new search test must be classified exactly once: by default an unlisted `src/**` test is unit tier; add it to `DB_DEPENDENT` only when it uses the real `src/lib/prisma` singleton, and to `HEAVY_TESTS` only when it is a full-cycle/bulk database suite. Do not create overlapping hand-maintained Jest exclusions.

### Frontend and browser checks

```bash
cd app/frontend
pnpm test -- --run search
pnpm run lint
pnpm run build
pnpm exec playwright test tests/e2e/universal-search.spec.ts
```

The focused frontend set covers the palette/controller, header trigger, shell, history, safe route construction, API DTOs, and admin report page. The Playwright suite checks the shared header at the documented viewport widths, dialog states, focus behavior, result navigation, local history, touch targets, no horizontal overflow, player/admin route boundaries, and the admin report surface.

When a change adds a real database dependency to a backend unit/property file, move that test to the integration tier before relying on a focused test command. Never make a failure advisory with `continue-on-error`, `|| true`, or an unguarded pipe.

## Troubleshooting

### The palette or header appears twice

Check that the route is under `PlayerShell` and that the page does not import `Navigation` independently. `PlayerShell.tsx` must own one `Navigation` and one `SearchPalette`; `/admin` must use `AdminLayout` instead.

### Search is unavailable or returns a generic error

Check authentication first, then inspect the phrase-free server diagnostics and the source failure. Do not expose or print the original query while debugging. Confirm the backend is using the existing error boundary and that `searchService.ts` has not leaked a Prisma/database error into the response.

### A one-character or whitespace query returns no results

This is expected. After trimming, fewer than two characters returns the three empty groups without source access. A query at the 100-character boundary is valid; a longer trimmed query is rejected by `searchQuerySchema`.

### A stable is missing

Confirm that the stable name is non-null and non-whitespace after trimming. Universal Search does not search usernames and does not use profile visibility or generated-account metadata as a filter. Named generated/test stables are eligible; unnamed accounts are not.

### A guide result is missing

Confirm the article is in `GuideService.getSearchIndex()` and that the query occurs in its title, description, or body text. Confirm that the entry has safe `sectionSlug` and article slug values. Do not add a second guide parser or return article body text to solve a search-index problem.

### Results appear in an unexpected order

Use `searchRanking.ts` as the oracle. Check edge trimming, case-insensitive exact/prefix/substring classification, guide strongest-field rank, and the documented category tie-break. Source/database order must never be used as an implicit tie-break.

### A result navigates to the wrong route or exposes extra data

Check `searchReferenceBuilder.ts`, the frontend `searchTypes.ts`, and `searchRoutes.ts` together. The route must be constructed only from positive IDs or safe guide slugs. Never use a label, username, raw query, or arbitrary server route. Destination access and not-found behavior must remain the authority after navigation.

### History is empty or cannot be cleared

Inspect `armoured-souls:recent-searches` in the current browser. Malformed JSON, unavailable storage, and quota/privacy failures intentionally degrade to empty or in-memory history. History must never block the network search and must never require a backend endpoint.

### Old results replace a newer query

Do not bypass `useSearchPalette`. Preserve the 200ms debounce, `AbortController`, and request-generation guard. A response may update state only when its generation and normalized query are still current.

### Admin analytics shows `analyticsDataIncomplete`

This means an eligible event write failed under the fail-open boundary. The player response remains valid, but the corresponding event was not created. Check the safe operation diagnostic and database availability, then use the admin report's limitation as the data-quality signal. Do not retry the failed phrase or synthesize an event.

### Analytics contains old-season rows or the purge count is missing

Check `seasonPurgeService.purgeHistory()` and its fixed `search_analytics_events` entry, then inspect the rollover result's `rowsDeleted`. Search analytics is active-season only; there is no cross-season archive. A failed required purge must not be hidden as a successful rollover.

### The report is rejected or unavailable

Verify the request is authenticated as an administrator, uses `/api/admin/search-analytics/report`, and sends only bounded `cycleFrom`, `cycleTo`, `page`, and `limit` values. The backend rejects a cycle range outside the active season and rejects `cycleFrom` greater than `cycleTo`. The admin page is not reachable from the player palette.

## Explicitly deferred

The MVP intentionally does **not** add:

- username search;
- fuzzy, phonetic, edit-distance, or approximate matching;
- command actions, page actions, or a command palette;
- click, result-selection, selected-category, or keystroke analytics; and
- cross-season Search_Analytics_Event storage or cross-season phrase analytics.

Teams, weapons, navigation pages/actions, battle reports/history, anonymous search, server-persisted recent history, player-visible analytics, and new stable privacy semantics are also outside this contract. Adding any deferred capability requires a separate contract, privacy/access review, source and DTO allow-list update, and corresponding test-tier/documentation work.

## Related implementation files

- Backend endpoint: `app/backend/src/routes/search.ts`
- Backend orchestration: `app/backend/src/services/search/searchService.ts`
- Ranking: `app/backend/src/services/search/searchRanking.ts`
- Result allow-list: `app/backend/src/services/search/searchReferenceBuilder.ts`
- Backend DTO/types: `app/backend/src/services/search/searchTypes.ts`
- Guide source: `app/backend/src/services/common/guide-service.ts`
- Analytics service/store/report: `app/backend/src/services/search/searchAnalyticsService.ts`, `searchAnalyticsStore.ts`, `searchAnalyticsReportService.ts`
- Active-season purge: `app/backend/src/services/season/seasonPurgeService.ts`
- Player shell: `app/frontend/src/components/layout/PlayerShell.tsx`
- Global Header: `app/frontend/src/components/Navigation.tsx`
- Palette/controller: `app/frontend/src/components/search/SearchPalette.tsx`, `useSearchPalette.ts`
- Browser history: `app/frontend/src/utils/searchHistory.ts`
- Safe route construction: `app/frontend/src/utils/searchRoutes.ts`
- Admin report page/API: `app/frontend/src/pages/admin/SearchAnalyticsPage.tsx`, `app/frontend/src/utils/adminSearchAnalyticsApi.ts`
