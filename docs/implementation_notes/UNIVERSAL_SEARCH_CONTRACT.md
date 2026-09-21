# Universal Search Contract

**Spec:** #56 — Universal Search
**Document role:** Normative implementation contract, data-boundary record, and verification runbook
**Scope:** MVP `Universal_Search_System` only
**Verification status:** This note lists verification commands; it does not record an execution result or claim that an unrun check passed.

## 1. Contract status and purpose

This document fixes the boundary for the authenticated player-facing Universal_Search_System. The MVP is a search-only palette for exactly three categories: robots, stables, and guide articles. It is not a general entity index, command launcher, or second authorization API.

The player response is a bounded `Search_Response` made from player-safe references. Existing destination routes remain responsible for authorization, ownership, visibility, sanitization, not-found behavior, and the complete destination representation. The server-side measurement boundary is separate from player search: Search_Analytics_Event values are written to the dedicated Search_Analytics_Store and are exposed only through the admin report resource.

This contract intentionally separates application behavior from release and verification evidence. A command below is a check to run, not evidence that the check has passed.

## 2. MVP search scope

The single player endpoint searches the following sources and fields. The source selector must remain allow-listed; adding a field to a database query does not add that field to the search contract.

| `MVP_Search_Category` | Search source | Searchable fields | Safe response fields | Approved destination |
|---|---|---|---|---|
| `robots` | `robots` / `Robot` plus the related `User` stable-name context | Robot `name` only | `category`, robot `id`, display `label` from `name`, optional `subtitle` from trimmed non-empty `stableName` | `/robots/:id` |
| `stables` | `users` / `User` | Trimmed, non-empty `stableName` only | `category`, `userId`, trimmed display `label` | `/stables/:userId` |
| `guide` | Existing `GuideService.getSearchIndex()` / `Guide_Search_Index` | Guide `title`, `description`, and `bodyText` for matching | `category`, `title`, `sectionTitle`, `sectionSlug`, `articleSlug` | `/guide/:sectionSlug/:articleSlug` |

### 2.1 Robots

Robot matching is against `name` only. A robot may include an optional stable subtitle when the related `stableName` is non-null, trimmed, and non-empty. If that subtitle is absent, the result omits `subtitle`; it never substitutes `username` or another account identifier.

The result does not include a full robot, account, weapon, combat, or private record. Generated and test accounts are not excluded from robot matching by a search-specific rule; the safe result still contains only the approved robot reference fields.

### 2.2 Stables

Stable matching is against trimmed, non-empty `stableName` only. Generated and seeded test stables participate when their trimmed `stableName` is non-empty. A null, empty, or whitespace-only `stableName` produces no Stable_Result.

`username` is never a stable search field and never appears in a Stable_Result. `profileVisibility` remains dormant/current behavior for this feature: Universal_Search_System does not invent a private-stable filter or change the existing stable destination semantics. No `isGenerated` prefix or username-prefix rule is used to decide eligibility.

### 2.3 Guide articles

Guide matching consumes the existing `GuideService.getSearchIndex()` result. The searchable text is the article title, description, and body text. The response contains only the article title, section context, and validated section/article slugs. Complete article body content is never returned by `GET /api/search`.

The feature does not create a second filesystem parser or a second guide-search endpoint. Guide results are in the same grouped response as robot and stable results.

## 3. Query normalization, ranking, and bounds

### 3.1 Request and normalization

The one player request is:

```text
GET /api/search?q={Search_Query}
```

The request schema accepts exactly one query key, `q`. Missing, repeated, non-string, unknown-key, and otherwise schema-invalid input uses the existing player-safe validation response and does not query any source. Leading and trailing whitespace is removed before length validation and matching. Internal whitespace and every other character are preserved. A query becomes empty when it contains no non-whitespace characters.

The code constants are:

```text
MINIMUM_QUERY_LENGTH = 2
MAXIMUM_QUERY_LENGTH = 100
SEARCH_DEBOUNCE_MS = 200
MAX_RESULTS_PER_CATEGORY = 10
MAX_TOTAL_RESULTS = 30
```

Their domain meanings are Minimum_Query_Length, Maximum_Query_Length, Search_Debounce_Window, Per_Category_Result_Limit, and Total_Result_Limit. A trimmed query longer than 100 characters uses the same player-safe validation response as other malformed input and performs no source or analytics work. A valid normalized query shorter than two characters is not an error: it returns exactly three empty groups without querying `robots`, `users`, or `GuideService.getSearchIndex()` and without recording analytics.

Matching is case-insensitive. The preserved normalized value is the exact `Normalized_Search_Phrase` used for eligible analytics capture; the player response does not echo the query.

### 3.2 Match ranking

Each source value is included only when it contains the normalized query case-insensitively. There is no fuzzy, phonetic, edit-distance, approximate, token-expansion, or typo-correction branch.

Within each result group, `Match_Rank` is ordered as:

1. `Exact_Match`: normalized query equals the complete searchable value;
2. `Prefix_Match`: the searchable value begins with the normalized query but is not exact; then
3. `Substring_Match`: the searchable value contains the normalized query but is neither exact nor prefix.

A Guide_Result receives the highest rank produced by any matching title, description, or body text. `sectionTitle` is display context, not an additional searchable field.

Same-rank ties use deterministic source-specific ordering independent of database return order:

- robots: lower-case `name`, then numeric `id`;
- stables: lower-case trimmed `stableName`, then numeric `userId`; and
- guide articles: lower-case `title`, then `sectionSlug`, then `articleSlug`.

The backend applies `Per_Category_Result_Limit` after rank and tie-break ordering. Each of `robots`, `stables`, and `guide` is limited independently to at most 10 results. The response has at most `Total_Result_Limit` (30) results because the three independently limited groups are not re-ranked against one another. There is no second response-wide ranking.

### 3.3 Search client timing

The Search_Client waits `SEARCH_DEBOUNCE_MS` (200 milliseconds) after the latest eligible input change before requesting results. It does not request the endpoint for a normalized query shorter than two characters. AbortController cancellation is an optimization; request-generation equality is the correctness guard, so an older response or error cannot replace the latest eligible query's state.

## 4. Player-safe DTO and destination access boundary

The response is one grouped DTO with fixed category order and no analytics fields:

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

The backend and frontend must preserve this allow-list. A Search_Result contains no `username`, `profileVisibility`, `bodyText`, password, token, private field, complete entity record, arbitrary route string, raw database payload, analytics field, or unrelated-account data.

Target_Route is derived from the discriminated identity fields by the client route builder. The client constructs only:

- robot: `/robots/:id` from a validated positive numeric `id`;
- stable: `/stables/:userId` from a validated positive numeric `userId`; and
- guide: `/guide/:sectionSlug/:articleSlug` from validated safe slug fields.

Raw Search_Query text, a result label, `username`, client-supplied account context, or an arbitrary server-provided route can never become a route segment. A selected result whose destination no longer exists or denies access is allowed to render the destination page's existing not-found or Access_Context response. Search does not add metadata to that response or create a second access policy.

`GET /api/search` requires the existing authentication middleware. An unauthenticated request receives the existing authentication failure without Search_Response data and without analytics. The existing general `/api` limiter and authenticated per-user limiter both apply; `/api/search` does not create a second search-specific policy. The per-user limiter runs after authentication and keeps the existing player-safe 429 response and `Retry-After` behavior. A rate-limited request performs no source search and no analytics write attempt.

All entity access is parameterized and bounded. The authenticated player identity comes from request context, never from `q`, a result payload, or a route parameter supplied by the client.

## 5. Query transport, logging, and no-copy boundary

The `q` value is permitted as transport only at the `GET /api/search?q=...` request boundary. This necessary URL occurrence is not application navigation state and must not be propagated.

Before request, validation, error, dependency, or rate-limit diagnostics are emitted, the safe path removes the query string (for example, `/api/search` rather than `/api/search?q=...`). Request logs, error logs, and rate-limit logs redact the transport `q`, raw Search_Query, and Normalized_Search_Phrase. Search persistence diagnostics contain only safe operational fields such as operation code, server timestamp/context when available, authenticated user ID, and result counts.

The raw or normalized phrase is never copied as an echo or metadata into:

- application navigation URLs or redirects;
- `Target_Route` values;
- player responses or error messages;
- ordinary application logs;
- general `audit_logs` payloads; or
- the full Search_Response.

A pre-existing source display label that happens to equal or contain the query remains valid result content; it is not query propagation. Raw normalized phrases may exist inside the dedicated Search_Analytics_Store and authorized Admin_Search_Analytics_Resource aggregation only. Search does not use `audit_logs` as an analytics store.

## 6. Shared player surface and route boundaries

### 6.1 Player_Shell and Global_Header

One shared `Player_Shell` owns one search state instance, exactly one existing `Navigation` instance, exactly one Search_Palette, and the route `Outlet`. All Post_Onboarding_Player_Route content is inside this shell, including normal content, lazy loading content, route errors, and not-found states. Page-by-page `Navigation` imports are not used to provide search.

The existing `Navigation` component is the `Global_Header`:

- at 1024px and above, the fixed desktop navbar exposes a visibly labelled `Search` Search_Control with a visible `⌘ K` or `Ctrl K` hint;
- below 1024px, the fixed mobile top header exposes a visible search icon/button;
- the mobile Search_Control is not in bottom navigation or the `More` drawer; and
- the visible Search_Control remains discoverable even when the shortcut is unavailable, since Cmd+K/Ctrl+K is an accelerator and never the sole discovery mechanism.

Opening the Search_Control does not navigate away from the current page. The Search_Palette visibly states its search-only scope, such as `Search robots, stables, or guide articles`, and provides results and Recent_Search_History only. It provides no command action, page action, or navigation-action execution.

### 6.2 Responsive and accessible behavior

The Search_Palette uses a bounded overlay at Desktop_Viewport widths (1024px and above), leaving the current page visible behind it. At Mobile_Viewport widths from 320px through 1023px it uses a vertically ordered, internally scrollable sheet with no horizontal overflow.

The palette opens with focus in its query input, exposes dialog and grouped-list semantics, traps Tab/Shift+Tab focus while active, supports Arrow-key movement and Enter activation for results, and dismisses with Escape. Focus returns to the Search_Trigger/opening control when it remains available. Search_Control, Clear_History_Control, retry, and every clickable Search_Result have visible focus indicators and a minimum 44px by 44px activation region. Loading, results, recent-history, too-short, empty, and error Search_State values have accessible names and readable category labels.

The `/onboarding` route, login/register/front-page routes, and `/admin` plus all admin descendants are outside the Player_Shell and do not render the player Search_Control or Search_Palette. The Admin_Portal is a separate administrator surface; it does not reuse the player shell.

## 7. Browser-local Recent_Search_History

Recent_Search_History is browser-local state, not an account feature and not a server resource. The implementation key is:

```text
RECENT_SEARCH_STORAGE_KEY = 'armoured-souls:recent-searches'
```

The adapter accepts only strings, trims each value, discards empty/whitespace-only and over-100-character entries, removes case-insensitive duplicates, retains at most `MAX_RECENT_SEARCHES = 5` values, and presents the newest value first. Malformed JSON, unavailable storage, and storage read/write/remove failures are tolerated; current-query search continues without Search_Error.

When the palette is open with an empty normalized query, it shows existing history when available and shows Clear_History_Control. Submitting a non-empty query or selecting a Search_Result stores the normalized query once. Selecting a Recent_Search puts it in the input and follows normal two-character/debounce behavior. Clearing removes all values from the current browser and shows the empty-history state.

Recent_Search_History is never sent to `GET /api/search`, stored in the backend, copied into a URL, or converted into a Search_Analytics_Event. Keystrokes, history operations, result selections, and selected categories are not analytics events.

## 8. Search analytics contract

### 8.1 Eligibility and isolation

An `Executed_Search` is an authenticated `GET /api/search` request with valid strict input, a normalized query of at least `MINIMUM_QUERY_LENGTH`, an accepted request-protection decision, and a completed grouped search. A zero-result grouped response is still an Executed_Search.

After the successful Search_Response is computable, the Search_Backend calls the dedicated Search_Analytics_Store exactly once for each Executed_Search. This boundary is separate from Search_Response shaping, browser history, `audit_logs`, `AdminAuditLog`, and player surfaces.

No Search_Analytics_Store attempt and no Search_Analytics_Event row is created for:

- a short normalized query;
- malformed, missing, repeated, unknown-key, non-string, or over-length input;
- an unauthenticated request;
- a general or per-user rate-limit rejection;
- a source/dependency failure before grouped search completes;
- keystrokes or debounce activity;
- Recent_Search_History reads, writes, selection, or clearing;
- result selection; or
- selected-category activity.

### 8.2 Event fields and cardinality

The dedicated Prisma model is `SearchAnalyticsEvent`, mapped to `search_analytics_events`, with the following event fields:

| Code field | Meaning |
|---|---|
| `id` | Server-generated event identity; not returned as a raw event row to players or ordinary admin report output |
| `seasonNumber` | Server-captured active season |
| `cycleNumber` | Server-captured cycle at write time |
| `userId` | Authenticated player identity from request context |
| `eventTimestamp` | Server-generated event timestamp |
| `normalizedPhrase` | Exact trimmed Normalized_Search_Phrase, retained only in the dedicated store and authorized admin aggregation |
| `robotResultCount` | Count in the `robots` Result_Group |
| `stableResultCount` | Count in the `stables` Result_Group |
| `guideResultCount` | Count in the `guide` Result_Group |
| `totalResultCount` | Sum of the three grouped counts |
| `noResult` | Whether `totalResultCount` equals zero |

A successful Search_Analytics_Store write creates exactly one Search_Analytics_Event row for that attempt. A persistence failure creates no row, performs no retry, queue, duplicate attempt, or fallback write, and does not change the successful Search_Response. Under Telemetry_Fail_Open, the player still receives the unchanged Search_Response while the Admin_Search_Analytics_Resource exposes a typed incomplete-telemetry limitation such as `analyticsDataIncomplete` for the affected report scope.

Safe internal diagnostics for Search_Persistence_Failure contain no phrase, raw request URL, complete response, token, or audit payload. A failed write is a missing telemetry event, not an invented zero-count event and not a reconstructed historical record.

## 9. Active-season retention and purge

Search_Analytics_Event rows are operational active-season data. The store and report service use the server-captured `seasonNumber` and `cycleNumber`, and the MVP retains raw events only for the active season. `Season_Rollover` adds `search_analytics_events` to the required explicit purge set through `seasonPurgeService.purgeHistory()`.

A rollover purge removes the season's Search_Analytics_Event values, reports the deletion through the existing purge accounting, and creates no archive or cross-season fallback. A required purge failure must remain visible through the existing rollover failure path; the rollover must not claim complete purge success. The MVP provides no cross-season Search_Analytics_Event archive or trend source.

## 10. Admin_Search_Analytics_Resource

The Admin_Portal exposes the administrator-only report API:

```text
GET /api/admin/search-analytics/report
```

The route uses the existing `authenticateToken` and `requireAdmin` boundaries plus strict query validation. It accepts only bounded report parameters such as:

```typescript
interface SearchAnalyticsReportQuery {
  cycleFrom?: number;
  cycleTo?: number;
  page?: number;
  limit?: number;
}
```

The service resolves the active season server-side and rejects historical-season requests because the MVP has no cross-season event archive. Report queries are set-based, bounded, deterministic, and paginated. The report envelope contains:

- active-season `period` with normalized `cycleFrom` and `cycleTo`;
- `overview.totalSearches`, `overview.uniqueSearchers`, and `overview.noResultSearches`;
- per-cycle `trends` with total, unique-searcher, and no-result values;
- bounded `topPhrases` and `noResultPhrases` summaries;
- `categoryUsage` for `robots`, `stables`, and `guide`;
- bounded, paginated `playerAnalysis` with safe `userId`, `stableName`, `searchCount`, `noResultCount`, `page`, `limit`, and `total`; and
- typed `limitations`, including `analyticsDataIncomplete` when failed persistence is known for the requested scope.

Raw event rows, raw event IDs, database payloads, passwords, tokens, unrelated-user data, and unbounded details are not returned. Raw phrases are available only to authorized administrators through the bounded report fields. Non-administrators receive the existing admin authorization failure without analytics data. The report page is `/admin/search-analytics`, remains inside the Admin_Portal, and is never exposed through Player_Shell or the player Search_Palette.

At widths below 1024px, the admin report stacks filters, sections, detail rows, and pagination vertically, preserves 44px controls, and has no horizontal overflow. This is an Admin_Portal boundary, not a player mobile palette boundary.

## 11. Deferred scope

The following remain outside this MVP and must not be added through an apparently harmless source-field or palette change:

- teams, weapons, usernames, navigation pages/actions, battle reports, and battle history;
- command actions, quick actions, page actions, or navigation actions in Search_Palette;
- fuzzy, phonetic, edit-distance, approximate, typo-correcting, or token-expansion matching;
- anonymous or unauthenticated search;
- server-side or cross-device Recent_Search_History storage/synchronization;
- Search_Result click tracking, selected-result tracking, selected-category tracking, keystroke tracking, or browser-activity analytics;
- player-visible analytics or raw Search_Analytics_Event access;
- analytics destinations outside the Admin_Portal Admin_Search_Analytics_Resource;
- retrying, duplicating, queueing, synthesizing, or backfilling failed telemetry;
- cross-season Search_Analytics_Event retention, archive, or trends;
- new stable privacy semantics or enforcement of dormant `profileVisibility`;
- changes to existing robot/stable destination authorization, ownership, sanitization, or not-found behavior;
- full robot, stable, or guide article records in Search_Response;
- replacing `GuideService.getSearchIndex()` or changing guide route behavior; and
- adding a second navigation shell or making Cmd+K/Ctrl+K the sole discovery mechanism.

The broader backlog description may mention players, weapons, pages, and battle history, but this contract delivers only robots, stables, and guide articles through a search-only palette plus admin-only usage reporting.

## 12. Verification commands

Run the following checks after the implementation is complete. This section is a runbook only; this document records no pass/fail result.

### 12.1 Spec and contract presence

```bash
test -f .kiro/specs/to-do/56-universal-search/requirements.md && test -f .kiro/specs/to-do/56-universal-search/.config.kiro
grep -R "GET /api/search\|Universal_Search_System\|Minimum_Query_Length\|Per_Category_Result_Limit\|Recent_Search_History\|Global_Header\|Player_Shell" app/backend/src app/frontend/src docs .kiro/specs/to-do/56-universal-search
```

### 12.2 Backend search and analytics checks

```bash
cd app/backend && pnpm run test:unit -- search && pnpm run build && pnpm run typecheck:tests
cd app/backend && pnpm run test:integration -- search
cd app/backend && pnpm run test:unit -- search && pnpm run test:integration -- search
grep -R "Search_Analytics_Event\|Search_Analytics_Store\|Telemetry_Fail_Open\|Admin_Search_Analytics_Resource\|Active_Season_Context\|Normalized_Search_Phrase" app/backend/src app/frontend/src docs .kiro/specs/to-do/56-universal-search
```

The backend checks must cover authentication, strict `q` validation, source scope, safe DTOs, ranking and bounds, parameterized access, destination references, exactly one analytics write attempt for each eligible completed search including zero results, one row only on persistence success, no row/no retry on persistence failure, unchanged Search_Response under Telemetry_Fail_Open, typed incomplete-telemetry limitation, admin authorization, bounded reporting, active-season filtering, and `Season_Rollover` purge behavior.

### 12.3 Frontend and browser checks

```bash
cd app/frontend && pnpm test -- --run search && pnpm run lint && pnpm run build
cd app/frontend && pnpm exec playwright test tests/e2e/universal-search.spec.ts
```

The frontend checks must cover the shared Player_Shell mount and excluded routes, Global_Header placement, visible scope text, Cmd+K/Ctrl+K, debounce and stale-response handling, loading/error/empty/too-short states, local history and clearing, approved route navigation, focus and touch behavior, 44px controls, and no horizontal overflow at 320px, 375px, 768px, 1023px, 1024px, and 1920px. Admin browser coverage must confirm that Search Analytics remains admin-only and stacks correctly below 1024px.

### 12.4 Phrase-leakage and transport-boundary check

```bash
grep -R "Search_Query\|Normalized_Search_Phrase" app/backend/src/middleware app/backend/src/routes app/backend/src/services app/backend/src/utils | grep -E "logger|log|audit_logs|originalUrl|redirect|navigate|Target_Route|response"
```

The result must be reviewed against the boundary above: `q` is allowed at `GET /api/search` transport only; request, error, and rate-limit logs are query-free; raw and normalized phrases are not copied into navigation URLs, redirects, Target_Route values, player responses, ordinary logs, or general `audit_logs` payloads; and a legitimate pre-existing display label is not treated as query propagation.

### 12.5 Blocking project gates

After the targeted checks, run the relevant blocking gates without `continue-on-error`, `|| true`, an unguarded output pipe, or an undocumented test exclusion:

```bash
cd app/backend && pnpm run lint
cd app/backend && pnpm run build
cd app/backend && pnpm run typecheck:tests
cd app/backend && pnpm run test:tiers:verify
cd app/backend && pnpm run test:unit
cd app/backend && pnpm run test:integration
cd app/backend && pnpm run test:heavy
cd app/frontend && pnpm run lint
cd app/frontend && pnpm run build
cd app/frontend && pnpm run test:ci
cd app/frontend && pnpm exec playwright test tests/e2e/universal-search.spec.ts
```

Record actual command output and execution context separately if release or verification evidence is required. The absence of such a record is not evidence that an unrun check passed.
