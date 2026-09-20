# Requirements Document

## Glossary

- **Universal_Search_System**: The authenticated player-facing search feature covering the three MVP search categories and the Search_Palette.
- **Search_Backend**: The backend portion of the Universal_Search_System that authenticates, validates, searches, ranks, limits and shapes search results.
- **Search_Client**: The frontend portion of the Universal_Search_System that opens the Search_Palette, debounces input, presents states and navigates to selected results.
- **Search_Palette**: The search-only overlay opened from the Search_Trigger or Search_Keyboard_Shortcut; the Search_Palette contains no command actions.
- **Search_Trigger**: The user activation affordance that opens the Search_Palette; the desktop and mobile presentation is the Search_Control.
- **Search_Keyboard_Shortcut**: Cmd+K on macOS and Ctrl+K on other platforms.
- **Authenticated_Player**: A signed-in player whose request is authenticated by the existing application authentication middleware.
- **Search_Endpoint**: The single authenticated backend endpoint `GET /api/search` with the documented `q` query parameter, used by the Search_Client for all MVP_Search_Category values.
- **Search_Query**: The raw text supplied through the `q` query parameter to the Search_Endpoint by an Authenticated_Player or Search_Client.
- **Normalized_Query**: A Search_Query after removal of leading and trailing whitespace. Normalized_Query preserves internal whitespace and all other characters, becomes empty when no non-whitespace characters remain, is compared case-insensitively for matching, and is the value considered for Recent_Search_History storage.
- **Minimum_Query_Length**: The minimum of 2 characters required for entity or guide searching after Normalized_Query processing.
- **Maximum_Query_Length**: The maximum of 100 characters permitted in a trimmed Search_Query.
- **Malformed_Search_Input**: A request whose documented Search_Query parameter is missing, repeated, non-string, unknown in name, or otherwise fails the Search_Endpoint request schema.
- **MVP_Search_Category**: One of the three categories `robots`, `stables` or `guide` returned by the Search_Endpoint.
- **Result_Group**: The category-labeled collection of Search_Result values in a Search_Response.
- **Search_Response**: The single bounded response containing one Result_Group for each MVP_Search_Category.
- **Search_Result**: One bounded, player-safe result reference containing a category, display label, optional subtitle and Target_Route.
- **Target_Route**: The client route opened when an Authenticated_Player selects a Search_Result.
- **Player_Safe_Reference**: A Search_Result containing only the identity and display information needed to navigate, with no full entity record or private field.
- **Robot_Result**: A Search_Result matched only against a robot `name`, targeting `/robots/:id`.
- **Stable_Result**: A Search_Result matched only against a non-empty, trimmed `stableName`, targeting `/stables/:userId`.
- **Guide_Result**: A Search_Result matched through the existing Guide_Search_Index, targeting `/guide/:sectionSlug/:articleSlug`.
- **Guide_Search_Index**: The existing full-text guide index returned by `getSearchIndex()`, including guide article title, description and body text.
- **Exact_Match**: A case-insensitive match where the Normalized_Query equals the complete searchable value.
- **Prefix_Match**: A case-insensitive match where the searchable value begins with the Normalized_Query but is not an Exact_Match.
- **Substring_Match**: A case-insensitive match where the searchable value contains the Normalized_Query but is neither an Exact_Match nor a Prefix_Match.
- **Match_Rank**: The ordering class Exact_Match before Prefix_Match before Substring_Match, followed by a deterministic tie-break independent of database return order.
- **Per_Category_Result_Limit**: The maximum of 10 Search_Result values returned in one Result_Group.
- **Total_Result_Limit**: The maximum of 30 Search_Result values returned in one Search_Response.
- **Search_Debounce_Window**: The 200-millisecond interval after the latest input change before the Search_Client requests results.
- **Recent_Search**: One non-empty Normalized_Query selected or submitted by the Authenticated_Player and stored only in the current browser's local storage.
- **Recent_Search_History**: The browser-local ordered set of at most five unique Recent_Search values, where uniqueness is case-insensitive and the most recent value appears first.
- **Clear_History_Control**: The accessible Search_Palette control that removes all Recent_Search values from the current browser.
- **Search_State**: One of the loading, results, recent-history, too-short, empty or error presentations shown by the Search_Palette.
- **Access_Context**: The existing owner/non-owner access behavior applied by the destination page and its endpoint.
- **Search_Error**: A player-safe error presentation that does not reveal backend, database or other players' data.
- **Desktop_Viewport**: A viewport at or above the existing 1024px desktop breakpoint.
- **Mobile_Viewport**: A viewport from 320px through 1023px inclusive.
- **Accessible_Result_List**: The keyboard- and assistive-technology-operable grouped list of Search_Result values.
- **Global_Header**: The existing `Navigation` component, consisting of the desktop fixed top navbar and the mobile fixed top header.
- **`Navigation`**: The existing code component that renders the desktop fixed top navbar and mobile fixed top header for the player shell.
- **Player_Shell**: The shared authenticated route layout that renders one `Navigation` instance and one Search_Palette around every Post_Onboarding_Player_Route.
- **Search_Control**: The visible desktop `Search` control with a `⌘ K` or `Ctrl K` hint, or the visible mobile search icon/button in the fixed top header.
- **Post_Onboarding_Player_Route**: An authenticated player route available after onboarding, excluding `/onboarding`, login/register/front-page routes and the separate `/admin` portal.
- **Admin_Portal**: The separate administrator-only application area at `/admin`, which is the reporting destination for Admin_Search_Analytics_Resource and is not part of the player-facing Player_Shell.
- **Admin_Search_Analytics_Resource**: The admin-only Search Analytics page/resource in the Admin_Portal that aggregates Search_Analytics_Event records for authorized administrators.
- **Search_Analytics_Event**: One persisted server-side measurement record for one Executed_Search, containing the authenticated player identity, server-captured Active_Season_Context, server-generated event timestamp, exact Normalized_Search_Phrase, robot/stable/guide result counts, total result count and no-result status; a failed persistence attempt creates no Search_Analytics_Event.
- **Search_Analytics_Store**: The dedicated persistence boundary for Search_Analytics_Event records, separate from `audit_logs` and separate from player search responses.
- **Telemetry_Fail_Open**: The policy under which each eligible completed search receives one analytics persistence attempt; a successful attempt creates one Search_Analytics_Event, while a failed attempt creates no event, performs no retry or duplicate attempt, preserves the successful Search_Response, and causes the admin report to expose a typed incomplete-telemetry limitation.
- **Executed_Search**: One authenticated Search_Endpoint request with valid input, a Normalized_Query containing at least Minimum_Query_Length characters after normalization, an accepted request-protection decision, and a completed grouped search.
- **Normalized_Search_Phrase**: The exact Normalized_Query stored in a Search_Analytics_Event and exposed only through authorized Admin_Search_Analytics_Resource reporting for top-query and no-result analysis.
- **Search_Analytics_Report**: A safe Admin_Search_Analytics_Resource output containing aggregate search totals, unique searchers, season/cycle trends, phrase summaries, no-result phrases, category usage and bounded per-player/stable analysis.
- **Active_Season_Context**: The server-captured current season and cycle associated with an Executed_Search at the time the Search_Analytics_Event is written.
- **Season_Rollover**: The existing operation that closes the active season and purges season-scoped operational data.

## Introduction

Backlog item #27 identifies the absence of a global search surface and describes a broad future search over robots, players, weapons, pages, guide articles and battle history. This requirements document defines the confirmed MVP only: robots searched by robot `name`, stables searched by trimmed non-empty `stableName`, and guide articles searched through the existing Guide_Search_Index.

The MVP uses one authenticated backend request for all three categories and includes the existing Guide_Search_Index in the same Search_Response, so the Search_Client does not need a second request. Search results are bounded Player_Safe_Reference values, not full records. Selecting a result opens the existing destination route, where current ownership, sanitization and stable-profile behavior remain authoritative.

The Search_Client is available through one shared Player_Shell around every Post_Onboarding_Player_Route. The Player_Shell renders the existing `Navigation` component and Search_Palette once, so the Global_Header remains available while route content is loading, displaying an error or rendering a not-found state without requiring page-by-page `Navigation` imports. The Global_Header is the desktop fixed top navbar and mobile fixed top header: desktop shows a visibly labelled `Search` Search_Control with a visible `⌘ K` or `Ctrl K` hint, while mobile shows a visible search icon/button in the fixed top header rather than in bottom navigation or the `More` drawer. The Search_Keyboard_Shortcut is an accelerator only and is never the sole discovery mechanism. When opened, the Search_Palette visibly explains its scope with text such as `Search robots, stables, or guide articles`.

The Universal_Search_System also has a measurement-only server boundary. The HTTP request necessarily carries Search_Query in the transport URL as `GET /api/search?q=...`; that transport occurrence is allowed. For each valid authenticated Executed_Search, including an Executed_Search with zero results in all three categories, the Search_Backend performs exactly one write attempt to the dedicated Search_Analytics_Store for the Admin_Portal's Admin_Search_Analytics_Resource. If persistence succeeds, exactly one Search_Analytics_Event row is created. If persistence fails, no event row is created, no retry or duplicate attempt occurs, the player receives the unchanged successful Search_Response, and the admin report exposes a typed incomplete-telemetry limitation under Telemetry_Fail_Open. Malformed, unauthenticated, short, over-length, rate-limited or failed requests produce no Search_Analytics_Event. The event does not track keystrokes, browser-local Recent_Search_History operations, result selection or selected category, does not expose analytics to players, does not alter Search_Response, and does not use browser-local history as a search event. The transport `q` value, raw Search_Query and Normalized_Search_Phrase are redacted from request logs, error logs and rate-limit logs. The Search_Backend does not copy the raw or normalized phrase as an echo or metadata into application navigation URLs, redirects, Target_Route values, player responses, ordinary application logs or general `audit_logs` payloads; a legitimate pre-existing display label that happens to equal or contain the query remains permitted as result content. Raw phrases are available only through authorized Admin_Search_Analytics_Resource reporting.

The feature is search-only for players. It does not add command actions, and its server-side Search_Analytics_Event is a separate measurement record rather than a player-facing search result or command surface. Generated and test stables participate when their trimmed `stableName` is non-empty; accounts with a null, empty or whitespace-only `stableName` produce no Stable_Result and are never matched through `username`. The `/onboarding` route, login/register/front-page routes and the separate `/admin` portal are outside the Player_Shell and Search_Palette scope; the Admin_Portal remains the authorized destination for Search_Analytics_Report values.

## Scope and Boundaries

1. **In scope:** one authenticated `GET /api/search` endpoint; robot-name, stable-name and guide full-text search; case-insensitive exact/prefix/substring ranking; bounded grouped references; desktop and mobile Search_Palette UI; Global_Header Search_Control placement in the existing `Navigation` component; Cmd+K/Ctrl+K opening; browser-local Recent_Search_History; one server-side Search_Analytics_Store write attempt per eligible Executed_Search and one persisted Search_Analytics_Event only when that attempt succeeds; the admin-only Admin_Search_Analytics_Resource and bounded Search_Analytics_Report; active-season analytics retention and Season_Rollover purge; route navigation; loading, error, empty and too-short states; keyboard, touch and assistive-technology accessibility; Player_Shell route-layout availability; security and access-preservation tests.
2. **Out of scope:** teams, weapons, usernames, navigation pages/actions, command actions, battle reports/history, fuzzy matching, anonymous search, server-persisted Recent_Search_History, new privacy semantics for stable profiles, changes to destination page authorization or sanitization, player-visible analytics, selected-result or selected-category tracking, and cross-season Search_Analytics_Event archives. The player-facing Search_Palette and Player_Shell remain outside `/onboarding`, login/register/front-page routes and the separate `/admin` portal; the Admin_Portal's Admin_Search_Analytics_Resource is in scope only for authorized administrator reporting.
3. **Global Header and shell boundary:** Global_Header means the existing code artefact `Navigation`, consisting of the desktop fixed top navbar and mobile fixed top header. One shared Player_Shell SHALL render `Navigation` and Search_Palette once around all Post_Onboarding_Player_Route content, including loading, error and not-found states; page-by-page `Navigation` imports are not part of this feature.
4. **Discovery boundary:** The desktop Search_Control is visibly labelled `Search` and includes a visible `⌘ K` or `Ctrl K` hint. The mobile Search_Control is a visible search icon/button in the fixed top header, not bottom navigation or the `More` drawer. Cmd+K/Ctrl+K is an accelerator only and never the sole discovery mechanism. An open Search_Palette visibly explains its scope, for example `Search robots, stables, or guide articles`.
5. **Robot access boundary:** Robot_Result values may target `/robots/:id`; the existing robot destination endpoint remains responsible for current owner/non-owner context and non-owner sanitization. Search results SHALL not expose more data than that destination makes available.
6. **Stable access boundary:** Stable_Result values may target `/stables/:userId`; the existing stable destination behavior remains authoritative. The existing `profileVisibility` field is dormant/current behavior for this feature: the Search_Backend SHALL not invent private-stable rules or introduce a new visibility policy.
7. **Guide access boundary:** Guide_Result values use the existing guide content and route behavior. The Search_Backend SHALL include only reference/display data from the Guide_Search_Index and SHALL not return complete article bodies.
8. **Analytics boundary:** Each valid authenticated Executed_Search, including a search that returns zero results, causes the Search_Backend to perform exactly one write attempt to the dedicated Search_Analytics_Store for the Admin_Search_Analytics_Resource. If persistence succeeds, exactly one Search_Analytics_Event row is created. If persistence fails, no event row is created, no retry or duplicate attempt occurs, the successful Search_Response remains unchanged, and the admin report exposes a typed incomplete-telemetry limitation under Telemetry_Fail_Open. Malformed, unauthenticated, short, over-length, rate-limited or failed requests create no event. Keystrokes, browser-local Recent_Search_History operations, result selections and selected categories create no event. The event captures authenticated identity, server-captured Active_Season_Context, server-generated timestamp, exact Normalized_Search_Phrase, robot/stable/guide counts, total count and no-result status. Search_Analytics_Event recording does not alter Search_Response or become available to players. The transport query `q` in `GET /api/search?q=...` is allowed, but the transport `q` value, raw Search_Query and Normalized_Search_Phrase are redacted from request logs, error logs and rate-limit logs and are not copied as an echo or metadata into application navigation URLs, redirects, Target_Route values, player responses, ordinary application logs or general `audit_logs` payloads. A legitimate pre-existing result display label that happens to equal or contain the query remains permitted. Raw phrases are admin-only through authorized reporting. Search_Analytics_Event records are retained only for the active season and are purged by Season_Rollover; the MVP creates no cross-season archive.

## Expected Contribution

1. **Close the global discovery gap:** Before this spec, the application has no global search surface and guide search is separate from robot/stable discovery. After implementation, one authenticated Search_Endpoint returns exactly three explicitly grouped MVP_Search_Category result groups in one request, with at most 10 results per category and 30 results total.
2. **Reduce search ambiguity without broad data exposure:** Before this spec, no shared ranking or response boundary exists. After implementation, matching is case-insensitive and deterministic with Exact_Match, Prefix_Match and Substring_Match ordering, while responses contain only Player_Safe_Reference values rather than full robot, stable or guide records.
3. **Preserve existing access behavior:** Before this spec, a global search could accidentally expose owner-only robot data, usernames or new stable privacy semantics. After implementation, robot and stable results contain only destination-safe references, use the existing target routes, include generated/test stables when named, omit unnamed stables, and leave destination authorization and sanitization unchanged.
4. **Provide one usable desktop/mobile entry point:** Before this spec, there is no universal Search_Trigger or shared recent-history flow, and the existing Global_Header has no search control. After implementation, the Player_Shell makes the Search_Control available on every Post_Onboarding_Player_Route: desktop exposes a visibly labelled `Search` control with a visible `⌘ K` or `Ctrl K` hint, mobile exposes a visible search icon/button in the fixed top header, and Cmd+K/Ctrl+K remains an accelerator rather than the sole discovery mechanism. Players can open a search-only palette, see its stated robots/stables/guide scope, navigate results with keyboard or touch, and use at most five browser-local Recent_Search values without server persistence.
5. **Make the feature verifiable:** Before this spec, no cross-category search contract, shared route-layout search surface or regression suite exists. After implementation, unit, integration and property-based tests cover matching, limits, response safety, authentication, malformed input, nullable stable names, generated/test inclusion, route references, Player_Shell single-mount coverage across loading/error/not-found states, excluded-route behavior, recent-history behavior, stale responses, loading/error/empty states and mobile accessibility. This directly addresses the missing global-search contract and page-composition gap identified by backlog item #27.
6. **Make search usage measurable without broadening player data exposure:** Before this spec, no dedicated search measurement boundary exists and no Admin_Portal resource can distinguish search volume, searchers, trends, popular phrases, no-result phrases or category usage. After implementation, every valid authenticated Executed_Search that passes validation and request protection and completes—including zero-result searches—receives exactly one analytics write attempt with authenticated identity, server-captured Active_Season_Context, server-generated event timestamp, exact Normalized_Search_Phrase, per-category counts, total count and no-result status. A successful write creates exactly one Search_Analytics_Event row; a failed write creates no row, performs no retry or duplicate attempt, leaves the successful Search_Response unchanged and yields a typed incomplete-telemetry limitation in the Admin_Search_Analytics_Resource under Telemetry_Fail_Open. Malformed, over-length, unauthenticated, rate-limited and failed requests, keystrokes, browser-local history operations, result selections and selected categories produce no event. The transport `q` in `GET /api/search?q=...` is permitted, while request logs, error logs and rate-limit logs redact the transport value and raw/normalized phrases; the phrase is not copied into application navigation URLs, redirects, Target_Route values, player responses, ordinary logs or general `audit_logs` payloads. The Admin_Search_Analytics_Resource exposes bounded, paginated and admin-authorized Search_Analytics_Report values, raw phrases remain admin-only, and active-season retention plus Season_Rollover purge prevents cross-season raw-event storage.

### Verification Criteria

1. `test -f .kiro/specs/to-do/56-universal-search/requirements.md && test -f .kiro/specs/to-do/56-universal-search/.config.kiro` confirms the numbered requirements-first spec and workflow metadata exist.
2. `grep -R "GET /api/search\|Universal_Search_System\|Minimum_Query_Length\|Per_Category_Result_Limit\|Recent_Search_History\|Global_Header\|Player_Shell" app/backend/src app/frontend/src docs .kiro/specs/to-do/56-universal-search` confirms the implemented contract, query boundary, bounded response policy, browser-local history and shared shell/header placement are represented in code and documentation after implementation.
3. `cd app/backend && pnpm run test:unit -- search && pnpm run build && pnpm run typecheck:tests` verifies matching, validation, shaping, access-safe references and backend test typing without an advisory bypass.
4. `cd app/backend && pnpm run test:integration -- search` verifies authentication, one-request grouped results, robot/stable access boundaries, malformed query handling, nullable `stableName`, generated/test stable inclusion, guide-index inclusion and destination references against PostgreSQL.
5. `cd app/frontend && pnpm test -- --run search && pnpm run lint && pnpm run build` verifies Search_Palette behavior, debounce, recent history, keyboard handling, stale-response handling, loading/error/empty/too-short states and frontend quality gates.
6. `cd app/frontend && pnpm exec playwright test tests/e2e/universal-search.spec.ts` verifies Desktop_Viewport and Mobile_Viewport rendering from 320px through 1920px, Global_Header Search_Control placement, Player_Shell availability through loading/error/not-found route states, exclusion of `/onboarding`, login/register/front-page routes and `/admin`, Cmd+K/Ctrl+K behavior, the visible palette scope explanation, clickable results, clear-history behavior, route navigation, keyboard focus, 44px activation regions and no horizontal overflow.
7. The backend and frontend property-based suites report passing properties for normalization, scope conservation, ranking, deterministic ordering, per-category/total limits, safe reference shape, nullable stable-name filtering, route construction, Recent_Search_History idempotence and latest-query presentation; route-layout tests report one Player_Shell mount of `Navigation` and Search_Palette for each Post_Onboarding_Player_Route and no mount for excluded routes.
8. `grep -R "Search_Analytics_Event\|Search_Analytics_Store\|Telemetry_Fail_Open\|Admin_Search_Analytics_Resource\|Active_Season_Context\|Normalized_Search_Phrase" app/backend/src app/frontend/src docs .kiro/specs/to-do/56-universal-search` confirms the dedicated analytics boundary, fail-open policy, admin destination, captured fields and active-season policy are represented in implementation and documentation.
9. `cd app/backend && pnpm run test:unit -- search && pnpm run test:integration -- search` verifies exactly one analytics write attempt for each eligible authenticated completed search including zero-result searches; exactly one Search_Analytics_Event row when persistence succeeds; no row and no retry or duplicate attempt when Search_Analytics_Store persistence fails; unchanged successful Search_Response under Telemetry_Fail_Open; a typed incomplete-telemetry limitation in the admin report; no write attempt or event for short, malformed, over-length, unauthenticated, rate-limited or failed requests, keystrokes/history operations/selections or selected categories; captured server fields; q transport redaction and phrase non-propagation; admin authorization; bounded/paginated reports; category/no-result metrics and active-season scoping against PostgreSQL.
10. `cd app/frontend && pnpm test -- --run search && pnpm exec playwright test tests/e2e/universal-search.spec.ts` verifies that Search_Response and player UI remain unchanged by analytics, Recent_Search_History remains browser-local, the Search_Control and shortcut are available only through the shared Player_Shell on authenticated post-onboarding routes, and analytics is not exposed on player surfaces or excluded routes.
11. `grep -R "Search_Query\|Normalized_Search_Phrase" app/backend/src/middleware app/backend/src/routes app/backend/src/services app/backend/src/utils | grep -E "logger|log|audit_logs|originalUrl|redirect|navigate|Target_Route|response"` returns no ordinary logging, redirect, navigation-URL, Target_Route, player-response or general `audit_logs` write path that copies raw or normalized search phrases; request-level tests confirm `GET /api/search?q=...` is allowed as transport while request, error and rate-limit logs redact `q` and the phrase. The final verification confirms the Season_Rollover purge removes active-season Search_Analytics_Event records without creating a cross-season archive.

## Requirements

### Requirement 1: Provide the Authenticated MVP Search Contract

**User Story:** As an Authenticated_Player, I want one search request to find the three MVP categories, so that I can discover existing game content without navigating separate search surfaces.

#### Acceptance Criteria

1. THE Search_Backend SHALL expose one authenticated Search_Endpoint at `GET /api/search` for all MVP_Search_Category values.
2. WHEN an Authenticated_Player submits a valid Search_Query, THE Search_Backend SHALL return one Search_Response containing one Result_Group for `robots`, one Result_Group for `stables` and one Result_Group for `guide`.
3. THE Search_Backend SHALL search robots only by `name`.
4. THE Search_Backend SHALL search stables only by trimmed non-empty `stableName`.
5. THE Search_Backend SHALL search guide articles only through the Guide_Search_Index.
6. THE Search_Backend SHALL include generated and test stables in Stable_Result matching when trimmed `stableName` is non-empty.
7. THE Search_Backend SHALL exclude `username`, teams, weapons, navigation pages/actions and battle reports/history from MVP_Search_Category matching.
8. IF a request is not authenticated, THEN THE Search_Backend SHALL return the existing authentication failure response without Search_Response data.
9. IF Normalized_Query contains fewer than Minimum_Query_Length characters, THEN THE Search_Backend SHALL return empty Result_Group values without querying entity records or the Guide_Search_Index.
10. IF a request contains Malformed_Search_Input, THEN THE Search_Backend SHALL return the existing player-safe validation response without querying entity records or the Guide_Search_Index.
11. IF Search_Query exceeds Maximum_Query_Length after trimming, THEN THE Search_Backend SHALL return the same player-safe validation response used for Malformed_Search_Input without querying entity records or the Guide_Search_Index.

### Requirement 2: Normalize, Rank and Bound Search Results

**User Story:** As an Authenticated_Player, I want the most direct matches first, so that the useful result appears without scanning an unbounded list.

#### Acceptance Criteria

1. THE Search_Backend SHALL create Normalized_Query by removing only leading and trailing whitespace from Search_Query.
2. THE Search_Backend SHALL compare Normalized_Query and searchable values case-insensitively while preserving internal whitespace and other non-whitespace characters.
3. THE Search_Backend SHALL assign Match_Rank in this order: Exact_Match, then Prefix_Match, then Substring_Match.
4. THE Search_Backend SHALL assign a Guide_Result the highest Match_Rank produced by any matching title, description or body value in the Guide_Search_Index.
5. THE Search_Backend SHALL return no Search_Result for a searchable value with no case-insensitive substring match with Normalized_Query.
6. THE Search_Backend SHALL apply Match_Rank ordering independently inside every Result_Group.
7. WHEN two Search_Result values have the same Match_Rank, THE Search_Backend SHALL order them by a documented deterministic tie-break independent of database return order.
8. THE Search_Backend SHALL return no more than 10 Search_Result values in any Result_Group.
9. THE Search_Backend SHALL return no more than 30 Search_Result values in one Search_Response.
10. THE Search_Backend SHALL apply Per_Category_Result_Limit after Match_Rank and deterministic tie-breaking.
11. THE Search_Backend SHALL use the three independently ranked Result_Group values to enforce Total_Result_Limit and SHALL not apply a second response-wide ranking across categories.
12. THE Search_Backend SHALL perform no fuzzy, phonetic, edit-distance or approximate matching in the MVP.

### Requirement 3: Return Player-Safe References and Preserve Destination Behavior

**User Story:** As an Authenticated_Player, I want search results to take me to the existing pages without learning private data from the search response, so that search behaves like navigation rather than a second data API.

#### Acceptance Criteria

1. WHEN the Search_Backend returns a Robot_Result, THE Search_Backend SHALL return only the category, the robot identity required for `/robots/:id`, the robot display `name`, an optional non-empty stable subtitle derived from trimmed `stableName`, and the Target_Route.
2. WHEN an Authenticated_Player selects a Robot_Result, THE Search_Client SHALL navigate to `/robots/:id`.
3. WHEN a Robot_Result is selected, THE Search_Client SHALL allow the existing robot destination endpoint to apply the current Access_Context and non-owner sanitization.
4. WHEN a robot has no non-empty stable subtitle, THE Search_Backend SHALL omit the subtitle field.
5. WHEN a robot has no non-empty stable subtitle, THE Search_Backend SHALL not substitute `username` or another account identifier.
6. WHEN the Search_Backend returns a Stable_Result, THE Search_Backend SHALL return only the category, the stable identity required for `/stables/:userId`, the trimmed stable display name, and the Target_Route.
7. THE Search_Backend SHALL omit `username` and the full stable profile from every Stable_Result.
8. WHEN an Authenticated_Player selects a Stable_Result, THE Search_Client SHALL navigate to `/stables/:userId`.
9. WHEN `stableName` is null, empty or whitespace-only, THE Search_Backend SHALL produce no Stable_Result for that account.
10. THE Search_Backend SHALL treat `profileVisibility` as dormant/current behavior and SHALL not add a private-stable filter.
11. WHEN the Search_Backend returns a Guide_Result, THE Search_Backend SHALL return only the article title, section context, `sectionSlug`, `articleSlug` and the Target_Route.
12. THE Search_Backend SHALL omit complete article body content from every Guide_Result.
13. WHEN an Authenticated_Player selects a Guide_Result, THE Search_Client SHALL navigate directly to `/guide/:sectionSlug/:articleSlug`.
14. THE Search_Backend SHALL ensure every Search_Result is a Player_Safe_Reference.
15. THE Search_Backend SHALL exclude passwords, tokens, private fields, unbounded entity payloads and unrelated-account data from every Search_Response.

### Requirement 4: Validate and Protect the Search Endpoint

**User Story:** As a maintainer, I want the search boundary to reject unsafe or excessive input, so that search cannot become an unbounded or cross-user data endpoint.

#### Acceptance Criteria

1. THE Search_Backend SHALL validate Search_Endpoint query parameters with the existing request-validation middleware.
2. THE Search_Backend SHALL accept only the documented Search_Query parameter for Search_Endpoint requests.
3. IF a request contains an unknown query parameter, THEN THE Search_Backend SHALL return the existing player-safe validation response without searching.
4. IF a request contains a non-string or otherwise schema-invalid Search_Query, THEN THE Search_Backend SHALL return the existing player-safe validation response without searching.
5. THE Search_Backend SHALL trim Search_Query before applying Maximum_Query_Length and matching.
6. THE Search_Backend SHALL use parameterized data access for all entity searches.
7. THE Search_Backend SHALL enforce Per_Category_Result_Limit and Total_Result_Limit before returning a Search_Response.
8. THE Search_Backend SHALL derive the Authenticated_Player identity from the authenticated request context.
9. THE Search_Backend SHALL ignore owner, account and visibility identities supplied by Search_Query or a client result payload.
10. THE Search_Backend SHALL apply the existing per-user/general request-protection policy to `GET /api/search`.
11. IF the request-protection policy rejects a request, THEN THE Search_Backend SHALL return a player-safe rate-limit response.
12. IF a backend search dependency fails, THEN THE Search_Backend SHALL return a Search_Error without stack traces, SQL, filesystem paths, account identifiers or raw Search_Query content in the player response.
13. THE Search_Backend SHALL load the Guide_Search_Index and entity matches within the same Search_Response contract.
14. THE Search_Client SHALL use no second search endpoint for the three MVP_Search_Category values.
15. THE Search_Backend SHALL redact the transport `q` value, raw Search_Query and Normalized_Search_Phrase from request, error and rate-limit logs and SHALL not write raw Search_Query or Normalized_Search_Phrase values, complete Search_Response payloads or authentication tokens to ordinary application logs.

### Requirement 5: Provide the Search-Only Desktop and Mobile Palette

**User Story:** As an Authenticated_Player, I want a visible and quickly reachable search surface on desktop and mobile, so that I can find a robot, stable or guide article from any Post_Onboarding_Player_Route.

#### Acceptance Criteria

1. THE Player_Shell SHALL make one Search_Control available through the Global_Header on every Post_Onboarding_Player_Route.
2. THE Search_Client SHALL render a desktop Search_Control visibly labelled `Search` in the fixed top navbar provided by the existing `Navigation` component.
3. THE Search_Client SHALL render a visible `⌘ K` or `Ctrl K` shortcut hint beside the desktop Search_Control.
4. THE Search_Client SHALL render a visible search icon/button as the mobile Search_Control in the fixed top header provided by the existing `Navigation` component.
5. THE Search_Client SHALL keep the mobile Search_Control out of bottom navigation and the `More` drawer.
6. WHEN an Authenticated_Player presses Cmd+K on macOS, THE Search_Client SHALL open the Search_Palette, focus the query input and prevent the browser's default action.
7. WHEN an Authenticated_Player presses Ctrl+K on a non-macOS platform, THE Search_Client SHALL open the Search_Palette, focus the query input and prevent the browser's default action.
8. THE Search_Client SHALL provide the Search_Control as a visible discovery mechanism independently of the Search_Keyboard_Shortcut.
9. WHILE the Search_Palette is open, THE Search_Client SHALL visibly explain the search scope with text such as `Search robots, stables, or guide articles`.
10. WHILE the Search_Palette is open, THE Search_Client SHALL provide search results and Recent_Search_History only.
11. WHILE the Search_Palette is open, THE Search_Client SHALL provide no command action, page action or navigation-action execution.
12. WHEN the Search_Control is activated, THE Search_Client SHALL open the Search_Palette without navigating away from the current page.
13. WHEN Search_Query changes, THE Search_Client SHALL wait for Search_Debounce_Window after the latest change before requesting results.
14. WHEN a response for an earlier query arrives after a later query becomes eligible, THE Search_Client SHALL ignore the earlier response and SHALL present only the latest eligible query's response.
15. WHEN Normalized_Query contains fewer than Minimum_Query_Length characters, THE Search_Client SHALL not request Search_Endpoint and SHALL show the too-short or Recent_Search_History Search_State.
16. WHEN Search_Response results are returned, THE Search_Client SHALL display Result_Group values in a consistent category order.
17. WHEN Search_Response results are returned, THE Search_Client SHALL make every Search_Result clickable.
18. WHEN an Authenticated_Player selects a Search_Result, THE Search_Client SHALL close the Search_Palette before navigating to the result's Target_Route.
19. WHEN the Search_Palette is open on a Mobile_Viewport, THE Search_Client SHALL present a vertically ordered, scrollable palette that fits from 320px through 1023px without horizontal overflow.
20. WHEN the Search_Palette is open on a Desktop_Viewport, THE Search_Client SHALL present a bounded overlay with grouped results and keep the current page visible behind the overlay.

### Requirement 6: Store and Use Browser-Local Recent Searches

**User Story:** As an Authenticated_Player, I want to reuse recent searches without sending a history to the server, so that repeated discovery is faster and remains browser-local.

#### Acceptance Criteria

1. WHEN the Search_Palette is open with an empty Normalized_Query, THE Search_Client SHALL show Recent_Search_History when Recent_Search_History contains values.
2. WHEN Recent_Search_History contains values, THE Search_Client SHALL show the Clear_History_Control.
3. WHEN an Authenticated_Player submits a non-empty Search_Query or selects a Search_Result, THE Search_Client SHALL store the Normalized_Query as one Recent_Search value in browser-local storage.
4. THE Search_Client SHALL retain at most five unique Recent_Search values.
5. THE Search_Client SHALL place the newest Recent_Search value first.
6. WHEN a new Recent_Search is case-insensitively equal to an existing Recent_Search, THE Search_Client SHALL remove the existing position before adding the newest position.
7. WHEN an Authenticated_Player selects a Recent_Search, THE Search_Client SHALL place that query in the input and apply the same Minimum_Query_Length behavior as a newly entered query.
8. WHEN the Clear_History_Control is activated, THE Search_Client SHALL remove all Recent_Search values from the current browser.
9. WHEN the Clear_History_Control is activated, THE Search_Client SHALL show the empty-history Search_State.
10. THE Search_Client SHALL store Recent_Search_History only in the current browser's local storage.
11. THE Search_Client SHALL not send Recent_Search_History values, account identifiers or history mutation requests to the Search_Backend.
12. IF browser-local storage contains an entry that is not a string, is whitespace-only after normalization, or exceeds Maximum_Query_Length, THEN THE Search_Client SHALL discard that entry while retaining valid entries.
13. IF browser-local storage is unavailable, THEN THE Search_Client SHALL continue current-query search without blocking Search_Error.
14. IF browser-local storage contains malformed history, THEN THE Search_Client SHALL continue current-query search without blocking Search_Error.

### Requirement 7: Present Complete Search States and Accessible Interaction

**User Story:** As an Authenticated_Player using a keyboard, touch device or assistive technology, I want clear states and operable controls, so that search remains usable when data is loading, absent or unavailable.

#### Acceptance Criteria

1. WHEN a Search_Endpoint request is in progress, THE Search_Client SHALL show a loading Search_State.
2. WHEN a response for an earlier query arrives after a later query becomes eligible, THE Search_Client SHALL prevent the earlier response from being presented as the current query's results.
3. WHEN a valid query returns no matches in all three MVP_Search_Category values, THE Search_Client SHALL show an empty Search_State identifying the searched categories without exposing internal query-processing details.
4. WHEN Search_Endpoint fails, THE Search_Client SHALL show a Search_Error with a retry control.
5. WHEN Search_Endpoint fails, THE Search_Client SHALL preserve the current Normalized_Query for retry.
6. WHEN the Search_Palette is opened, THE Search_Client SHALL move focus into the query input.
7. WHEN the Search_Palette is opened, THE Search_Client SHALL expose an accessible name and dialog/list semantics.
8. WHILE the Search_Palette is active, THE Search_Client SHALL keep keyboard focus within the active palette until dismissal.
9. WHEN an Authenticated_Player uses Arrow keys in the Search_Palette, THE Search_Client SHALL provide visible focus movement through the Accessible_Result_List.
10. WHEN an Authenticated_Player uses Tab in the Search_Palette, THE Search_Client SHALL move focus among palette controls without leaving the active palette.
11. WHEN an Authenticated_Player uses Enter on a focused Search_Result, THE Search_Client SHALL select that Search_Result.
12. WHEN an Authenticated_Player uses Escape in the Search_Palette, THE Search_Client SHALL dismiss the Search_Palette.
13. WHEN the Search_Palette is dismissed, THE Search_Client SHALL restore focus to the Search_Trigger or opening control when that control remains available.
14. THE Search_Client SHALL provide touch and pointer activation regions of at least 44px by 44px for the Search_Trigger, Clear_History_Control, retry control and every clickable Search_Result.
15. THE Search_Client SHALL provide visible focus indicators and readable category labels.
16. THE Search_Client SHALL provide accessible names that distinguish robots, stables, guide articles, Recent_Search values, the Clear_History_Control, retry and dismissal controls.
17. THE Search_Client SHALL render the Search_Palette without horizontal overflow at 320px, 375px, 768px, 1023px, 1024px and 1920px viewport widths.

### Requirement 8: Preserve Search and Destination Route Semantics

**User Story:** As an Authenticated_Player, I want selected results to behave like the existing pages, so that search does not create a second authorization or routing model.

#### Acceptance Criteria

1. WHEN a Search_Result contains a robot identity, THE Search_Client SHALL construct only the `/robots/:id` Target_Route from the validated result reference.
2. THE Search_Client SHALL not construct a robot Target_Route from unsanitized Search_Query text.
3. WHEN a Search_Result contains a stable identity, THE Search_Client SHALL construct only the `/stables/:userId` Target_Route from the validated result reference.
4. THE Search_Client SHALL not expose or substitute a username while constructing a stable Target_Route.
5. WHEN a Search_Result contains guide section and article identities, THE Search_Client SHALL construct only `/guide/:sectionSlug/:articleSlug` from validated slug references.
6. IF a selected result's destination no longer exists or denies access under the existing destination behavior, THEN THE Search_Client SHALL allow the destination page's existing not-found or access response to render.
7. IF a selected result's destination no longer exists or denies access under the existing destination behavior, THEN THE Search_Client SHALL not reveal additional search metadata.
8. THE Search_Backend SHALL return no result identity that cannot be represented by one of the three approved Target_Route forms.

### Requirement 9: Test the Feature as a Blocking Contract

**User Story:** As a maintainer, I want automated tests for the search contract and its privacy boundaries, so that future search changes cannot silently broaden scope or leak data.

#### Acceptance Criteria

1. THE backend unit-test suite SHALL cover normalization, Exact_Match/Prefix_Match/Substring_Match ranking, deterministic tie-breaking, per-category and total limits, no-fuzzy behavior, malformed input and Player_Safe_Reference shaping.
2. THE backend integration-test suite SHALL cover authentication, one-request grouped results, robot owner/non-owner result safety, stable `stableName` null/cleared behavior, generated/test stable inclusion, Guide_Search_Index inclusion, rate limiting and destination route references.
3. THE frontend unit-test suite SHALL cover Search_Control, Search_Keyboard_Shortcut, Search_Debounce_Window, stale-response handling, grouped clickable results, Recent_Search_History, Clear_History_Control and loading/error/empty/too-short Search_State values.
4. THE frontend browser-test suite SHALL cover Desktop_Viewport and Mobile_Viewport rendering, all required viewport widths, Global_Header Search_Control placement, visible palette scope explanation, keyboard focus and dismissal, touch activation, route navigation, 44px activation regions and no horizontal overflow.
5. THE route-layout test suite SHALL verify that one shared Player_Shell renders `Navigation` and Search_Palette once around every Post_Onboarding_Player_Route, retains the shell through loading/error/not-found states, and excludes `/onboarding`, login/register/front-page routes and `/admin`.
6. THE property-based test suite SHALL generate varied robot names, stable names, Guide_Search_Index values and queries to verify the correctness properties in this document without making external service calls.
7. THE backend and Admin_Portal test suites SHALL cover Search_Analytics_Event cardinality as one write attempt per eligible completed search, one row on persistence success and no row/no retry or duplicate attempt on persistence failure, Telemetry_Fail_Open preservation of successful Search_Response and typed incomplete-telemetry limitation, captured fields, no-event exclusions, phrase transport redaction and non-leakage, active-season retention, Season_Rollover purge, admin authorization, report aggregates, category/no-result metrics and bounded/paginated per-player/stable analysis.
8. THE frontend and browser-test suites SHALL verify that Recent_Search_History remains browser-local, result/category selections do not create Search_Analytics_Event values, Search_Response remains unchanged by analytics including Telemetry_Fail_Open persistence failure, the Admin_Search_Analytics_Resource is not exposed on player routes, and its Mobile_Viewport layout has no horizontal overflow and has 44px touch targets.
9. IF any test or workflow step added for the Universal_Search_System can pass while its search, access, limit, privacy or analytics assertion fails, THEN the implementation SHALL correct the test or implementation and SHALL not mark the check advisory through `continue-on-error`, `|| true`, an unguarded output pipe or test exclusion without a documented cause and expiry.

### Requirement 10: Document the Implemented Search Contract

**User Story:** As a maintainer, I want the search scope and data boundaries documented, so that future requests do not silently expand the MVP or duplicate access rules.

#### Acceptance Criteria

1. THE implementation documentation SHALL record the three MVP_Search_Category values, searchable fields, Normalized_Query semantics, Match_Rank order, Per_Category_Result_Limit, Total_Result_Limit, Search_Debounce_Window and no-fuzzy boundary.
2. THE implementation documentation SHALL record that `username` is excluded, generated/test stables are included when trimmed `stableName` is non-empty, null/cleared stable names produce no Stable_Result, and `profileVisibility` remains dormant/current behavior.
3. THE implementation documentation SHALL record the single `GET /api/search` endpoint and `q` transport query, the allowed request-URL transport boundary, request, error and rate-limit log redaction, Player_Safe_Reference response boundary, authentication requirement, rate-limit behavior, route targets and destination Access_Context preservation rule, including the prohibition on copying raw or normalized search phrases into application navigation URLs, redirects, Target_Route values, player responses, ordinary logs or general `audit_logs` payloads.
4. THE implementation documentation SHALL record browser-local Recent_Search_History, the five-item limit, case-insensitive uniqueness, Clear_History_Control behavior, keyboard shortcuts, mobile layout and accessibility requirements.
5. THE implementation documentation SHALL identify the existing Guide_Search_Index and destination routes used by the feature and SHALL identify teams, weapons, usernames, navigation pages/actions, battle reports/history, command actions and fuzzy matching as deferred scope.
6. THE implementation documentation SHALL record the Admin_Portal Admin_Search_Analytics_Resource, one analytics write attempt per eligible completed Executed_Search after Minimum_Query_Length, one Search_Analytics_Event row on persistence success, Telemetry_Fail_Open behavior with no event/no retry or duplicate attempt and a typed incomplete-telemetry limitation on persistence failure, captured fields, no selected-result/category tracking, dedicated Search_Analytics_Store separation from `audit_logs`, active-season retention, Season_Rollover purge, admin authorization, bounded/paginated reporting and the separation from browser-local Recent_Search_History.
7. WHEN Verification Criteria pass, THE implementation SHALL update backlog item #27 to state the delivered MVP scope rather than claim that the broader backlog description was implemented.

### Requirement 11: Provide Shared Post-Onboarding Shell Availability

**User Story:** As an Authenticated_Player, I want search to remain available while player pages load or fail, so that I can discover robots, stables and guide articles without each page implementing its own navigation shell.

#### Acceptance Criteria

1. THE Player_Shell SHALL render the existing `Navigation` component and Search_Palette once around all Post_Onboarding_Player_Route content.
2. THE Player_Shell SHALL retain the Global_Header and Search_Palette while a Post_Onboarding_Player_Route displays loading content.
3. THE Player_Shell SHALL retain the Global_Header and Search_Palette while a Post_Onboarding_Player_Route displays an error state.
4. THE Player_Shell SHALL retain the Global_Header and Search_Palette while a Post_Onboarding_Player_Route displays a not-found state.
5. THE Player_Shell SHALL exclude `/onboarding`, login/register/front-page routes and the separate `/admin` portal.
6. THE Search_Client SHALL not require page-by-page `Navigation` imports to make the Search_Control or Search_Palette available on a Post_Onboarding_Player_Route.

### Requirement 12: Measure Search Usage Through Admin-Only Analytics

**User Story:** As an administrator, I want safe search-usage reports, so that I can understand discovery demand and no-result gaps without exposing analytics or search phrases to players.

#### Acceptance Criteria

1. WHEN a valid authenticated Search_Endpoint request passes request protection and completes with a Normalized_Query containing at least Minimum_Query_Length characters, THE Search_Backend SHALL perform exactly one Search_Analytics_Store write attempt for that Executed_Search, including when all three Result_Group values are empty; a successful attempt SHALL create exactly one Search_Analytics_Event row, while a failed attempt SHALL create no event row, perform no retry or duplicate attempt, preserve the unchanged successful Search_Response and cause the Admin_Search_Analytics_Resource to expose a typed incomplete-telemetry limitation under Telemetry_Fail_Open.
2. IF Normalized_Query contains fewer than Minimum_Query_Length characters, THEN THE Search_Backend SHALL perform no Search_Analytics_Store write attempt and SHALL write no Search_Analytics_Event.
3. IF a request contains Malformed_Search_Input or exceeds Maximum_Query_Length, THEN THE Search_Backend SHALL perform no Search_Analytics_Store write attempt and SHALL write no Search_Analytics_Event.
4. IF a request is unauthenticated, THEN THE Search_Backend SHALL perform no Search_Analytics_Store write attempt and SHALL write no Search_Analytics_Event.
5. IF the request-protection policy rejects a request, THEN THE Search_Backend SHALL perform no Search_Analytics_Store write attempt and SHALL write no Search_Analytics_Event.
6. IF a Search_Endpoint request fails before completing an Executed_Search, THEN THE Search_Backend SHALL perform no Search_Analytics_Store write attempt and SHALL write no Search_Analytics_Event.
7. THE Search_Analytics_Store SHALL record Search_Analytics_Event values only for completed Search_Endpoint executions.
8. THE Search_Backend SHALL perform no Search_Analytics_Store write attempt, and THE Search_Analytics_Store SHALL record no Search_Analytics_Event, for keystrokes, browser-local Recent_Search_History operations, result selections or selected categories.
9. THE Search_Backend SHALL record the authenticated player identity, server-captured Active_Season_Context and server-generated event timestamp in every Search_Analytics_Event.
10. THE Search_Backend SHALL record the exact Normalized_Search_Phrase, robot result count, stable result count, guide result count, total result count and no-result status in every Search_Analytics_Event.
11. THE Search_Backend SHALL keep Search_Analytics_Event recording separate from Search_Response shaping so analytics does not alter the Search_Endpoint response, including when Search_Analytics_Store persistence fails under Telemetry_Fail_Open.
12. THE Search_Backend SHALL keep Search_Analytics_Event values and raw Normalized_Search_Phrase values unavailable to players.
13. THE Search_Backend SHALL redact the transport `q` value, raw Search_Query and Normalized_Search_Phrase from request, error and rate-limit logs and SHALL not copy the raw or normalized phrase as an echo or metadata into application navigation URLs, redirects, Target_Route values, player responses, ordinary application logs or general `audit_logs` payloads.
14. THE Admin_Portal SHALL provide an Admin_Search_Analytics_Resource for authorized administrator reporting.
15. WHEN an authorized administrator requests a Search_Analytics_Report, THE Admin_Search_Analytics_Resource SHALL report total searches, unique searchers and season/cycle trend values.
16. WHEN an authorized administrator requests a Search_Analytics_Report, THE Admin_Search_Analytics_Resource SHALL report top phrases, no-result phrases and category usage from Search_Analytics_Event values.
17. WHEN an authorized administrator requests detailed analytics, THE Admin_Search_Analytics_Resource SHALL provide safe per-player/stable analysis with bounded, paginated detail.
18. IF a non-administrator requests the Admin_Search_Analytics_Resource, THEN THE Admin_Search_Analytics_Resource SHALL return the existing admin authorization failure response without analytics data.
19. WHILE an active season is in progress, THE Search_Analytics_Store SHALL retain raw Search_Analytics_Event values only for the active season and SHALL provide no cross-season archive in the MVP.
20. WHEN Season_Rollover occurs, THE Search_Analytics_Store SHALL purge the season's Search_Analytics_Event values.
21. WHEN the Admin_Search_Analytics_Resource is displayed on a Mobile_Viewport, THE Admin_Search_Analytics_Resource SHALL stack report sections and detail controls vertically, preserve touch activation regions of at least 44px by 44px and render without horizontal overflow.

## Correctness Properties for Property-Based Testing

The following properties are testable against pure search-ranking, response-shaping, route-building, browser-history, analytics-event construction and report-aggregation functions with mocked persistence and Guide_Search_Index inputs. The Player_Shell availability property is a route-layout invariant verified with route/component tests rather than external-service property tests. Search_Analytics_Store authorization and Season_Rollover purge behavior use integration tests with representative database fixtures. Property-based tests SHALL not call external services or rely on mutable production data.

The property reflection removes duplicate coverage before formulation: stable eligibility, safe-reference shaping, response bounds, latest-query handling, history insertion, route construction, shell route coverage, analytics event cardinality and analytics report aggregation each have one comprehensive property or structural invariant rather than several overlapping properties.

1. **Scope conservation:** For every generated source dataset and query, every returned Search_Result belongs to exactly one of `robots`, `stables` or `guide`, and every result is derived only from an allowed robot `name`, trimmed non-empty `stableName` or Guide_Search_Index entry. No generated username, team, weapon, navigation-page or battle-history record can appear.
2. **Normalization and case invariance:** For every generated query and searchable value, adding or removing leading/trailing whitespace produces the same Normalized_Query after trimming, and replacing query or value characters with case variants produces the same match classification and ordered result identity.
3. **Rank monotonicity:** For every Result_Group containing an Exact_Match, Prefix_Match and Substring_Match, every Exact_Match precedes every Prefix_Match and every Prefix_Match precedes every Substring_Match.
4. **Deterministic ordering:** For every source collection, any permutation of the collection produces the same ordered Search_Result references after the documented Match_Rank tie-break is applied.
5. **Bound preservation:** For every source collection and query, each Result_Group contains at most 10 values and the Search_Response contains at most 30 values, including when all source collections exceed the limits.
6. **No fuzzy matches:** For every generated query and searchable value with no case-insensitive substring relationship, the pair produces no Search_Result regardless of edit distance or phonetic similarity.
7. **Stable-name eligibility:** For every generated account, a null, empty or whitespace-only `stableName` produces no Stable_Result; every trimmed non-empty `stableName` may produce a Stable_Result when the query matches; changing `profileVisibility` alone does not change this search eligibility.
8. **Safe robot subtitle:** For every generated robot reference, the absence of a non-empty stable subtitle removes only the subtitle field and never introduces `username`, private fields or a second identity source.
9. **Route construction:** For every valid Search_Result reference, a robot result constructs `/robots/:id`, a stable result constructs `/stables/:userId`, and a guide result constructs `/guide/:sectionSlug/:articleSlug`; arbitrary Search_Query text cannot become an unvalidated route segment.
10. **Recent-history idempotence and bound:** For every sequence of submitted queries, normalizing and inserting the same query repeatedly leaves one newest case-insensitive occurrence, preserves most-recent-first order, retains no more than five unique values, and clearing history produces an empty history.
11. **Grouped-response conservation:** For every valid query, combining the three Result_Group collections yields exactly the Search_Response result set, with no duplicate result identity within a category and no result outside its category.
12. **Latest-query presentation:** For every sequence of debounced query values and out-of-order mocked responses, the Search_Client presents only the response associated with the latest eligible Normalized_Query and never replaces it with an older response.
13. **Player-shell availability and exclusion:** For every Post_Onboarding_Player_Route and route-content state of loading, error or not-found, the route layout presents exactly one Player_Shell containing one `Navigation` instance and one Search_Palette; `/onboarding`, login/register/front-page routes and `/admin` present no Player_Shell-owned Search_Control or Search_Palette.
14. **Analytics event cardinality and exclusion:** For every generated sequence of query changes and request outcomes, each valid authenticated Search_Endpoint request that passes validation and request protection, completes a search, and has a Normalized_Query meeting Minimum_Query_Length—including zero-result searches—causes exactly one Search_Analytics_Store write attempt; persistence success creates exactly one Search_Analytics_Event row, while persistence failure creates no row, performs no retry or duplicate attempt, preserves the successful Search_Response and yields a typed incomplete-telemetry limitation under Telemetry_Fail_Open. The generated sequence contains no analytics write attempt or event for short, malformed, over-length, unauthenticated, rate-limited or failed requests, keystrokes, browser-local Recent_Search_History operations, result selections or selected categories.
15. **Analytics event completeness and response isolation:** For every generated eligible search response whose analytics persistence succeeds, the corresponding Search_Analytics_Event contains the authenticated identity, server-captured Active_Season_Context, server-generated event timestamp, exact Normalized_Search_Phrase, three category counts, total count and no-result status. For a persistence failure, no event row is created, the successful Search_Response remains unchanged, the analytics record is unavailable to players and the admin report exposes a typed incomplete-telemetry limitation; raw or normalized phrases are not copied into ordinary logs, general `audit_logs` payloads, application navigation URLs, redirects, Target_Route values or player responses. The request URL occurrence `GET /api/search?q=...` remains transport-only and request, error and rate-limit logs redact `q` and the phrase.
16. **Admin analytics aggregation, authorization and retention:** For every generated active-season Search_Analytics_Event collection and set of failed analytics write attempts, Search_Analytics_Report totals, unique-searcher counts, season/cycle trends, top phrases, no-result phrases, category usage and per-player/stable analysis equal the authorized persisted event set, detail remains bounded and paginated, each failed write is represented by a typed incomplete-telemetry limitation without an invented event row, non-administrator access returns no report data, and Season_Rollover leaves no retained event or cross-season archive.

## Deliberately Out of Scope

- Searching usernames or exposing account discovery through username values.
- Searching teams, weapons, navigation pages/actions, battle reports or battle history.
- Command execution, quick actions or page-action shortcuts from the Search_Palette.
- Fuzzy, phonetic, edit-distance or approximate matching.
- Anonymous or unauthenticated search.
- Server-side storage, synchronization or analytics of Recent_Search_History.
- Tracking Search_Result selections, selected result categories, command actions or keystrokes as Search_Analytics_Event values.
- Treating the transport query `q` from `GET /api/search?q=...` as application navigation state, a redirect parameter, a Target_Route value, a player-response echo, an ordinary log field or a general `audit_logs` payload; request transport is allowed only at the Search_Endpoint boundary with request, error and rate-limit log redaction.
- Player-visible Search_Analytics_Report values, player access to raw Search_Analytics_Event records, or changing Search_Response to carry analytics data.
- Retrying, duplicating, queueing, synthesizing or cross-season backfilling a failed Search_Analytics_Store persistence attempt; Telemetry_Fail_Open instead exposes a typed incomplete-telemetry limitation.
- Cross-season retention, archival or trend reporting from Search_Analytics_Event values in the MVP.
- New analytics destinations outside the Admin_Portal's Admin_Search_Analytics_Resource.
- New stable privacy semantics, enforcement of dormant `profileVisibility`, or changes to the existing stable endpoint.
- Changes to robot owner/non-owner sanitization or destination-page authorization.
- Returning full robot, stable or guide article records from the Search_Endpoint.
- Replacing the existing Guide_Search_Index or guide article route behavior.
- Rendering Search_Palette through page-by-page `Navigation` imports or creating a second navigation shell instead of the shared Player_Shell.
- Making Cmd+K/Ctrl+K the sole way to discover the Search_Palette.
- Making the Player_Shell or Search_Palette available on `/onboarding`, login/register/front-page routes or the separate `/admin` portal; the Admin_Portal's Admin_Search_Analytics_Resource remains in scope as the authorized reporting destination.
