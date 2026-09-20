# Product Requirements Document: Universal Search

**Surface:** Global Header Search Palette
**Player routes:** All authenticated post-onboarding player routes
**Endpoint:** `GET /api/search?q=...`
**Spec:** #56
**Status:** Product contract

## 1. Purpose

Universal Search gives an authenticated player one consistent, search-only discovery surface for robots, stables and guide articles. It is opened from the existing `Navigation` component, which remains the Global_Header for the player shell. Search is a navigation aid, not a second entity API, command menu or authorization layer.

This PRD documents the player-visible contract and the measurement boundary that supports the separate Admin_Portal report. It does not broaden the MVP to the wider backlog description of searching players, weapons, pages or battle history, and it does not assert that any test, build, deployment or release check has run.

## 2. Product principles

1. **One entry point:** The same Search_Control is available from the shared Player_Shell on every Post_Onboarding_Player_Route.
2. **Search only:** The Search_Palette contains search input, results and browser-local Recent_Search_History. It contains no command actions, quick actions or page-action execution.
3. **Three bounded categories:** The MVP searches only robots, stables and guide articles and returns at most 10 results per category and 30 results overall.
4. **Destination authority:** A result is a Player_Safe_Reference. The selected destination remains responsible for ownership, authorization, not-found and sanitization behavior.
5. **Visible and accessible discovery:** The shortcut accelerates access but never replaces a visible control. Pointer, touch, keyboard and assistive-technology interactions are supported.
6. **Local history:** Recent searches remain in the current browser only. They are never sent as history mutations or included in a player search request.
7. **No silent scope expansion:** Teams, weapons, usernames, navigation pages/actions, battle history, fuzzy matching and anonymous search remain deferred.

## 3. Glossary

- **Universal_Search_System:** The authenticated player-facing search feature covering the Search_Palette, three MVP categories, browser-local history and its measurement boundary.
- **Authenticated_Player:** A signed-in player accepted by the existing authentication middleware.
- **Search_Backend:** The authenticated endpoint and service boundary that validates, searches, ranks, limits and shapes results.
- **Search_Client:** The frontend trigger, Search_Palette, typed request client, debounce behavior, route builder and browser-local history adapter.
- **Search_Endpoint:** The single authenticated `GET /api/search` endpoint used for all MVP categories.
- **Search_Query:** The raw text supplied through the `q` query parameter.
- **Normalized_Query:** Search_Query after leading and trailing whitespace is removed. Internal whitespace and all other characters are preserved.
- **Minimum_Query_Length:** The minimum of two characters required before an entity or guide request is made.
- **Maximum_Query_Length:** The maximum of 100 characters after trimming.
- **MVP_Search_Category:** One of `robots`, `stables` or `guide`.
- **Result_Group:** One category-labelled collection in a Search_Response.
- **Search_Response:** One bounded response containing the three Result_Group values in fixed order.
- **Search_Result:** One bounded result reference belonging to exactly one MVP_Search_Category.
- **Player_Safe_Reference:** A Search_Result containing only the identity and display information needed to navigate.
- **Robot_Result:** A result matched by robot name and targeting `/robots/:id`.
- **Stable_Result:** A result matched by a trimmed, non-empty stable name and targeting `/stables/:userId`.
- **Guide_Result:** A result matched through the existing Guide_Search_Index and targeting `/guide/:sectionSlug/:articleSlug`.
- **Guide_Search_Index:** The existing guide search data returned by `getSearchIndex()`, including title, description and body text for matching but not complete body content in player results.
- **Exact_Match:** A case-insensitive match where Normalized_Query equals the complete searchable value.
- **Prefix_Match:** A case-insensitive match where the searchable value begins with Normalized_Query but is not exact.
- **Substring_Match:** A case-insensitive match where the searchable value contains Normalized_Query but is neither exact nor prefix.
- **Match_Rank:** The ordering Exact_Match, then Prefix_Match, then Substring_Match.
- **Per_Category_Result_Limit:** The maximum of 10 Search_Result values in one Result_Group.
- **Total_Result_Limit:** The maximum of 30 Search_Result values in one Search_Response.
- **Search_Debounce_Window:** The 200ms interval after the latest input change before an eligible request is made.
- **Search_Keyboard_Shortcut:** Cmd+K on macOS and Ctrl+K on other platforms.
- **Global_Header:** The existing `Navigation` component, consisting of the fixed desktop top navbar and fixed mobile top header.
- **Search_Control:** The visible desktop Search control with a shortcut hint, or the visible mobile search icon/button.
- **Search_Palette:** The search-only dialog opened by the Search_Control or Search_Keyboard_Shortcut.
- **Search_State:** One of the loading, results, recent-history, too-short, empty or error presentations.
- **Recent_Search:** One non-empty Normalized_Query stored in the current browser.
- **Recent_Search_History:** The current browser's ordered set of at most five unique Recent_Search values, newest first and unique case-insensitively.
- **Clear_History_Control:** The accessible control that removes all Recent_Search_History values from the current browser.
- **Target_Route:** The approved client route opened when a player selects a Search_Result.
- **Access_Context:** The existing owner/non-owner, not-found, sanitization and authorization behavior applied by the destination page.
- **Search_Error:** A player-safe error presentation that reveals no backend, database, account or raw-query detail.
- **Player_Shell:** The shared authenticated route layout that renders exactly one Global_Header and one Search_Palette around each Post_Onboarding_Player_Route.
- **Post_Onboarding_Player_Route:** An authenticated player route available after onboarding, excluding onboarding, authentication/front-page routes and the separate Admin_Portal.
- **Desktop_Viewport:** A viewport at or above the existing 1024px breakpoint.
- **Mobile_Viewport:** A viewport from 320px through 1023px inclusive.
- **Accessible_Result_List:** The grouped result list operable by pointer, keyboard and assistive technology.
- **Admin_Portal:** The separate administrator-only application area under `/admin`.
- **Admin_Search_Analytics_Resource:** The admin-only reporting resource for aggregate search usage.
- **Search_Analytics_Store:** The dedicated persistence boundary for search measurement, separate from player responses, browser history and `audit_logs`.
- **Search_Analytics_Event:** One server-side measurement record for one eligible completed search.
- **Executed_Search:** An authenticated, valid, request-protected search with a Normalized_Query meeting Minimum_Query_Length and a completed grouped response.
- **Telemetry_Fail_Open:** The policy under which a successful player Search_Response is preserved when Search_Analytics_Store persistence fails.
- **Active_Season_Context:** The server-captured season and cycle associated with an Executed_Search.
- **Season_Rollover:** The existing operation that closes a season and purges season-scoped operational data.

## 4. MVP scope

### 4.1 Search categories

The Search_Backend returns exactly three Result_Group values in this order:

| Group | Searchable source | Matching behavior | Target_Route |
|---|---|---|---|
| Robots | `Robot.name` only | Case-insensitive Exact_Match, Prefix_Match or Substring_Match | `/robots/:id` |
| Stables | Trimmed, non-empty `User.stableName` only | Case-insensitive Exact_Match, Prefix_Match or Substring_Match | `/stables/:userId` |
| Guide | Existing Guide_Search_Index title, description or body text | Best Match_Rank across the indexed fields | `/guide/:sectionSlug/:articleSlug` |

Generated and test stables are included when `stableName` is trimmed and non-empty. A null, empty or whitespace-only `stableName` produces no Stable_Result. `username` is never a search field, result label, subtitle fallback or route source. `profileVisibility` remains dormant/current destination behavior; Universal Search does not invent a new stable privacy policy.

The Search_Client uses one authenticated Search_Endpoint request for all three groups. It does not call separate robot, stable or guide search endpoints. Valid queries shorter than Minimum_Query_Length show an empty grouped response locally and do not query entity records or the Guide_Search_Index.

### 4.2 Normalization, ranking and bounds

- Normalized_Query removes only leading and trailing whitespace.
- Internal whitespace and all other non-whitespace characters remain meaningful.
- Matching is case-insensitive, but display values retain their stored form.
- Match_Rank is ordered Exact_Match, Prefix_Match, then Substring_Match.
- Guide_Result rank is the best rank from its indexed title, description or body text.
- Equal-rank results use a deterministic category-specific tie-break, never database return order.
- Each Result_Group is ranked and limited independently to Per_Category_Result_Limit.
- The three independently ranked groups enforce Total_Result_Limit; there is no second response-wide ranking across categories.
- No fuzzy, phonetic, edit-distance or approximate matching is included.
- Search input is subject to the existing authentication, validation, general request-protection and authenticated per-user request-protection boundaries.

## 5. Player_Shell and route availability

### 5.1 Shared composition

One Player_Shell owns the search surface for all Post_Onboarding_Player_Route content. It renders:

1. exactly one existing `Navigation` instance as the Global_Header;
2. exactly one Search_Palette instance; and
3. the current route content inside the shell.

Pages do not import or compose their own search header or palette. This keeps discovery consistent and prevents duplicate controls when routes change.

The shell contains route loading, error and not-found content. Therefore the Global_Header and Search_Palette remain available while a post-onboarding player page is loading, displaying an error or rendering a not-found state. A player can open search without waiting for the current page to finish rendering and can recover from a page-level failure by navigating to an approved result.

### 5.2 Included routes

The Search_Control and Search_Palette are available on authenticated player routes after onboarding, including route-level loading, error and not-found states. They do not depend on each page importing `Navigation`.

### 5.3 Excluded routes

The Player_Shell-owned search surface is not rendered on:

- `/onboarding`;
- login, registration and front-page routes, including `/` where it is the front page; or
- `/admin` and all Admin_Portal descendants.

The Admin_Portal may have its separate Admin_Search_Analytics_Resource, but that resource is not a player search destination and is not exposed through the player Global_Header or Search_Palette.

## 6. Global_Header Search_Control

### 6.1 Desktop placement: 1024px and wider

At a Desktop_Viewport, the fixed top navbar provided by `Navigation` contains a visibly labelled **Search** control. The control includes a visible platform-appropriate hint: `⌘ K` on macOS or `Ctrl K` on other platforms. The label and hint remain visible without hover and are not replaced by the shortcut alone.

Activating the desktop Search_Control opens the Search_Palette over the current route without changing the route. The opening control is remembered for focus restoration when the palette closes.

### 6.2 Mobile placement: 320–1023px

At a Mobile_Viewport, the fixed top header provided by `Navigation` contains a visible search icon/button. It is placed in the top header, not in bottom navigation and not in the `More` drawer. The icon/button has an accessible name that identifies it as Search and has a minimum 44px by 44px activation region.

The mobile control is a first-class discovery mechanism. A player does not need to know or use Cmd+K/Ctrl+K to find search.

### 6.3 Keyboard accelerator

Search_Keyboard_Shortcut opens the same Search_Palette:

- Cmd+K on macOS; and
- Ctrl+K on other platforms.

The client prevents the browser default action, focuses the palette query input and does not navigate to a new page. The shortcut is an accelerator only; the visible Search_Control remains available on every included route.

## 7. Search_Palette behavior

### 7.1 Opening and scope

The Search_Palette is a dialog with an accessible name and visible scope text such as:

> Search robots, stables, or guide articles

It opens without changing the current route. It contains only:

- the query input;
- search status and grouped results;
- Recent_Search_History when applicable;
- retry and dismissal controls; and
- the Clear_History_Control when history exists.

It does not contain command actions, page actions, navigation-action execution, account switching, filters for deferred categories or a second search surface.

### 7.2 Search request behavior

After each query change, Search_Client waits Search_Debounce_Window before requesting results. It does not request the Search_Endpoint when Normalized_Query is shorter than Minimum_Query_Length. If multiple eligible queries are entered quickly, only the latest eligible response may be presented; an older response or error must not replace the current query's state.

The Search_Client shows category groups consistently as robots, stables, then guide. Every Search_Result is a clickable, keyboard-operable result. Selecting a result closes the palette before navigation.

### 7.3 Search states

| Search_State | When it appears | Player-visible behavior |
|---|---|---|
| Recent history | The palette is open with an empty Normalized_Query and local history exists | Show newest-first recent queries and Clear history. No server request is made. |
| Too short | The normalized query is non-empty but shorter than two characters | Explain that more input is needed. Do not request the Search_Endpoint. |
| Loading | An eligible request is in progress | Show a clear loading indication while retaining the current query. |
| Results | One or more Result_Group values contain results | Show grouped, labelled, bounded results in consistent order. |
| Empty | A valid query has no robot, stable or guide results | Identify the searched categories without exposing internal query-processing details. |
| Error | The Search_Endpoint fails | Show a player-safe Search_Error and a retry control. Preserve the current Normalized_Query for retry. |

When history is empty after clearing, the palette shows an empty-history presentation rather than stale values. Browser-local storage failures do not block current-query search.

## 8. Search result presentation and safe navigation

### 8.1 Player-safe result references

Search results are references, not full records:

- **Robot_Result:** category, robot identity needed for the route, display name, optional non-empty trimmed stable subtitle and the approved route identity. If no stable subtitle exists, omit it; never substitute `username` or another account identifier.
- **Stable_Result:** category, stable identity needed for the route, trimmed stable display name and the approved route identity. Do not include `username`, the full stable profile or dormant visibility fields.
- **Guide_Result:** category, article title, section context, `sectionSlug`, `articleSlug` and the approved route identity. Do not include complete article body content.

No result contains passwords, tokens, private fields, unbounded entity payloads, unrelated-account data or an arbitrary server-provided route string.

### 8.2 Approved route construction

The Search_Client constructs Target_Route values only from validated result identity fields:

| Result | Target_Route |
|---|---|
| Robot_Result | `/robots/:id` |
| Stable_Result | `/stables/:userId` |
| Guide_Result | `/guide/:sectionSlug/:articleSlug` |

Raw Search_Query text, result labels, `username`, arbitrary route strings and client-supplied account context cannot become route segments. Selecting a result does not append the raw or normalized query as navigation state, metadata or a redirect parameter.

### 8.3 Existing destination behavior remains authoritative

Search does not create a second authorization model. After navigation:

- the robot page and endpoint apply the existing owner/non-owner Access_Context and sanitization;
- the stable page and endpoint apply existing stable access behavior without a new `profileVisibility` rule; and
- the guide route applies existing guide lookup and not-found behavior.

If the selected robot, stable or article no longer exists, or the destination denies access, the destination's existing not-found or access response renders normally. Search does not reveal additional search metadata, the reason a result changed, or private destination data.

## 9. Browser-local Recent_Search_History

Recent_Search_History is stored only in the current browser under the client-local storage boundary `armoured-souls:recent-searches`.

- A non-empty normalized query is stored when the player submits it or selects a Search_Result.
- At most five unique values are retained.
- Uniqueness is case-insensitive.
- A repeated query is removed from its old position and inserted first with its latest normalized value.
- The newest value appears first.
- Selecting a recent value puts it in the input and follows the same Minimum_Query_Length, debounce and request behavior as newly entered text.
- Clear_History_Control removes all current-browser values and shows the empty-history state.
- History is never sent to the Search_Backend, included in `GET /api/search`, or synchronized to the account.
- Account identifiers, selected categories, selected results and history mutations are not search requests or player-visible analytics events.
- Invalid local entries—non-strings, whitespace-only values or values longer than Maximum_Query_Length—are discarded while valid entries remain.
- Malformed local storage and unavailable local storage fail safely; current-query search continues.

## 10. Responsive behavior

### 10.1 Mobile_Viewport: 320–1023px

The palette is a vertically ordered, internally scrollable mobile sheet. The sheet fits from 320px through 1023px without page-level horizontal overflow. Its input, scope text, states, result groups, recent history and controls remain readable in a single-column flow.

Results and history use full-width rows or cards with clear category labels. Long labels wrap or truncate safely without widening the viewport. The mobile Global_Header remains the source of the Search_Control; search is not moved into bottom navigation or the `More` drawer.

### 10.2 Desktop_Viewport: 1024px and wider

The palette is a bounded overlay over the current page. The page remains visible behind the overlay, and result groups are presented in a scannable desktop layout without forcing page-level horizontal scrolling. The desktop Global_Header retains the labelled Search control and visible shortcut hint.

### 10.3 Responsive baseline

The surface must remain usable at 320px, 375px, 768px, 1023px, 1024px and 1920px widths. No layout depends on hover, and no required control is hidden solely because the keyboard shortcut is unknown.

## 11. Accessibility and interaction requirements

- The Search_Palette uses dialog semantics, an accessible name and labelled input.
- Opening the palette moves focus into the query input.
- While active, keyboard focus remains within the palette until dismissal.
- Tab and Shift+Tab move through palette controls without leaving the active dialog.
- Arrow keys visibly move focus through the Accessible_Result_List.
- Enter activates the focused Search_Result.
- Escape dismisses the palette.
- Dismissing the palette restores focus to the Search_Control or opening control when it remains available.
- Search_Control, Clear_History_Control, retry, dismissal and every clickable Search_Result provide touch/pointer activation regions of at least 44px by 44px.
- Focus indicators are visible in every responsive presentation.
- Category labels distinguish robots, stables and guide articles for sighted and assistive-technology users.
- Accessible names distinguish recent queries, clear history, retry, dismissal and each result category.
- Loading, empty, too-short and error states are conveyed in text and are not dependent on color alone.
- Result activation works with pointer, touch, keyboard and assistive technology.

## 12. Authentication, privacy and measurement boundary

### 12.1 Player request boundary

`GET /api/search?q=...` requires an authenticated player and accepts only the documented `q` query parameter. Existing request validation and general/per-user request-protection behavior apply. Validation, authentication, rate-limit and dependency errors remain player-safe and do not expose stack traces, SQL, filesystem paths, account identifiers or raw Search_Query text.

The `q` value is permitted as transport at the Search_Endpoint boundary only. Raw Search_Query and Normalized_Query are redacted from request, error and rate-limit logs and are not copied into application navigation URLs, redirects, Target_Route values, player responses, ordinary application logs or general `audit_logs` payloads. A legitimate pre-existing result display label that happens to contain the query remains valid result content.

### 12.2 Admin-only search measurement

The Search_Analytics_Store is separate from the Search_Response, browser-local Recent_Search_History and `audit_logs`. For each eligible Executed_Search, including a completed zero-result search, the Search_Backend makes exactly one persistence attempt. On success, exactly one Search_Analytics_Event is stored. On persistence failure:

- no event row is created;
- no retry, queue or duplicate attempt occurs;
- the successful player Search_Response remains unchanged; and
- the Admin_Search_Analytics_Resource exposes a typed incomplete-telemetry limitation under Telemetry_Fail_Open.

Short, malformed, over-length, unauthenticated, rate-limited and failed requests do not create an event or make an analytics write attempt. Keystrokes, history operations, result selections and selected categories do not create events.

A successful event records only server-owned measurement fields: authenticated player identity, server-generated timestamp, Active_Season_Context, exact normalized phrase, per-category result counts, total result count and no-result status. These values are unavailable to players. The Admin_Search_Analytics_Resource is admin-authorized, active-season scoped and bounded/paginated; its detailed analysis does not expose raw event payloads or security data.

Search measurement is retained only for the active season. Season_Rollover purges active-season Search_Analytics_Event values and creates no cross-season archive in this MVP. Browser-local history remains independent of this server-side measurement boundary.

## 13. Deferred scope and non-goals

The following are intentionally deferred and must not be added through incremental search changes without a new product decision:

- searching usernames or broad account discovery;
- searching teams;
- searching weapons or weapon inventory;
- searching navigation pages, page actions or arbitrary application routes;
- searching battle reports or battle history;
- command execution, quick actions or page-action shortcuts in the Search_Palette;
- fuzzy, phonetic, edit-distance or approximate matching;
- anonymous or unauthenticated search;
- server-side storage, synchronization or player-visible analytics of Recent_Search_History;
- tracking keystrokes, selected results or selected categories as player search events;
- exposing Search_Analytics_Event rows or Search_Analytics_Report values to players;
- changing Search_Response to carry analytics data;
- new stable privacy semantics or enforcement of dormant `profileVisibility`;
- changes to existing robot owner/non-owner sanitization or destination authorization;
- returning full robot, stable or guide article records;
- replacing the existing Guide_Search_Index or guide route behavior;
- making Cmd+K/Ctrl+K the sole discovery mechanism; and
- rendering Search_Palette through page-by-page navigation imports or a second route shell.

## 14. Related documentation

- [Page PRD index](README.md)
- [Admin Portal PRD](PRD_ADMIN_PAGE.md)
- [Stable View PRD](PRD_STABLE_VIEW_PAGE.md)
- [Robot Detail PRD](PRD_ROBOT_DETAIL_PAGE.md)
- [Battle History PRD](PRD_BATTLE_HISTORY_PAGE.md)
- [Frontend standards](../../.kiro/steering/frontend-standards.md)
- [Testing strategy](../../.kiro/steering/testing-strategy.md)

## 15. Documentation status

This document records the intended player-visible Universal Search contract and its explicit boundaries. It is not a test or release report; no unrun check is represented as passed here.
