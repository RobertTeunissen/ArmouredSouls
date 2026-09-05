# Requirements Document

## Glossary

- **First_Party_Telemetry**: Usage measurement collected by the application and stored in this project; no external analytics provider or SDK is used.
- **Usage_Event**: One allowlisted interaction or lifecycle record, identified by a client-generated event ID and associated server-side with the authenticated account.
- **Usage_Events**: The stored collection of accepted Usage_Event records used for aggregation and retention.
- **Usage_Session**: A random client session identifier covering one active authenticated browser session; it contains no account identifier or personal data.
- **Canonical_Route**: The normalized pathname used for page measurement, without query strings, fragments, raw URLs or free-form route data.
- **Source_Surface**: The allowlisted surface that caused an event, such as the mobile bottom navigation, the More drawer, a Dashboard section or a page action.
- **Dashboard_Section**: One named, measurable section of the current Dashboard, including the notification stack, `OverviewRow`, `RecentBattles`, `UpcomingMatches`, `ActiveTournamentCard`, `LeagueStandingsSummary` and the My Robots area.
- **Overview_Row**: The existing three-tile Dashboard module containing `PrestigeTile`, `TodaysBattlesTile` and `CreditsTile` in fixed order.
- **Current_Cycle**: The in-progress cycle from the most recent midnight UTC settlement boundary through the current request time.
- **Activation_Region**: The full interactive area available to pointer, keyboard and assistive-technology users; changed controls must provide at least 44px by 44px where both dimensions apply.
- **Mobile_Navigation**: The current below-`lg` navigation surface containing Dashboard, Robots, Battles, Shop and More.
- **Device_Bucket**: A coarse allowlisted device category used for aggregation; it is not a raw user-agent value.
- **Viewport_Bucket**: A coarse allowlisted viewport category used for aggregation, including the tested width boundaries and no exact client dimensions in stored events.
- **Measurement_Fixture**: Deterministic test data and browser setup used to measure the current Dashboard and Mobile_Navigation without mutable production data.
- **Measurement_Window**: The documented period during which production Usage_Events are collected for the first Current_State_Report.
- **Current_State_Report**: The factual report of routes, transitions, navigation use, Dashboard_Section reach, actions, timing and data coverage observed during a Measurement_Window.
- **Evidence_Gate**: The recorded review that permits an Approved_Change, requests more measurement or confirms that no UI change is justified.
- **Approved_Change**: A specifically named Dashboard or mobile-navigation change permitted by the Evidence_Gate; it may also be an explicit no-change decision.
- **Consent_Decision**: The recorded decision about the legal/product basis, user control and environments in which First_Party_Telemetry may be collected.
- **Retention_Window**: The approved duration for retaining raw Usage_Events before deletion or irreversible aggregation.
- **Event_Allowlist**: The finite set of event names and event-specific properties accepted by the ingestion boundary.
- **Admin_Report**: An aggregate usage report available only to authorized administrators and containing no user-level event export.

## Introduction

Backlog item #60 asks whether the Dashboard and mobile navigation need optimization. The repository currently provides no general page-view, session, navigation or Dashboard-section telemetry. `app/frontend/src/utils/onboardingAnalytics.ts` is onboarding-only; `eventLogger.ts` records game-domain audit events; `securityMonitor.ts` records security events; request logs do not observe React Router transitions; and no analytics model, consent setting or external analytics SDK exists.

The current implementation must therefore be measured before its information hierarchy or mobile navigation is changed. `Navigation.tsx` currently exposes five below-`lg` entry points: Dashboard, Robots, Battles, Shop and More. `DashboardPage.tsx` currently composes notifications, `OverviewRow`, battle sections, tournament content, standings and the robot area. This spec records their use; it does not assume that any section should be removed, collapsed, deferred, moved, renamed or added to Mobile_Navigation.

The first implementation adds minimal First_Party_Telemetry without changing visible content, route structure or current data meaning. It then produces a Current_State_Report. Only the Evidence_Gate may authorize a later Approved_Change. If the evidence does not justify a change, the required outcome is a documented no-change decision rather than a speculative redesign.

## Scope and Boundaries

1. **In scope:** authenticated page and route measurement, the current Mobile_Navigation, Dashboard_Section impressions and actions, coarse device/viewport dimensions, first-party ingestion and storage, aggregate reporting, privacy controls, documentation and before/after verification.
2. **Out of scope before the Evidence_Gate:** changing Dashboard content, section order, tile semantics, page layout, mobile-navigation buttons, navigation labels, routing, notification limits or loading behavior.
3. **External analytics is out of scope:** no external provider, SDK, session replay, heatmap, raw recording or outbound project/user data transfer is introduced.
4. **Existing game audit and security records remain separate:** Usage_Events are not written to `audit_logs`, `EventLogger` or `SecurityMonitor`.
5. **A later Approved_Change may be implemented in this spec only after the Current_State_Report and Evidence_Gate are complete.** The approved result may be no UI change.

## Expected Contribution

1. **General usage evidence:** Before, the application has no durable general page, session or navigation usage record. After, seven allowlisted event types—`session_started`, `page_view`, `primary_nav_click`, `more_item_click`, `dashboard_section_impression`, `dashboard_action` and `page_ready`—measure authenticated route use and current Dashboard interaction without external tracking.
2. **Current-state visibility:** Before, decisions about the five mobile buttons and Dashboard length rely on code inspection. After, an Admin_Report identifies route popularity, route transitions, button and More-drawer use, Dashboard_Section reach/actions, viewport/device buckets, timing and data coverage for a documented Measurement_Window.
3. **Privacy and data control:** Before, there is no general usage consent or retention boundary. After, a Consent_Decision, strict Event_Allowlist, server-derived account association, payload limits, rate limiting, deduplication and Retention_Window govern collection and access; raw URLs, query strings, IP addresses, user agents, referrers and free-form text are not stored.
4. **Evidence-based execution:** Before, Spec 52 contains unselected layout policies and assumed mobile outcomes. After, the Evidence_Gate records `approve_change`, `collect_more_data` or `no_change`, the evidence supporting it, and any Approved_Change acceptance criteria before Dashboard or Mobile_Navigation behavior is modified.
5. **Measured regression protection:** Before, no repeatable usage/scroll/request baseline exists. After, the Measurement_Fixture and automated tests compare current and approved behavior at 320px, 375px, 768px, 1023px, 1024px and 1920px, including no horizontal overflow and unchanged visible navigation during the measurement phase.

### Verification Criteria

1. `grep -R "session_started\|page_view\|primary_nav_click\|more_item_click\|dashboard_section_impression\|dashboard_action\|page_ready" app/frontend/src app/backend/src` — confirms all seven event names have implementation references.
2. `test -f app/frontend/src/utils/usageAnalytics.ts && test -f app/backend/src/services/usage/usageEventService.ts && test -f app/backend/src/services/usage/usageReportService.ts && test -f docs/implementation_notes/dashboard-mobile-usage-measurement.md` — confirms the first-party client, ingestion/report services and evidence record exist.
3. `grep -n "Consent_Decision\|Retention_Window\|raw URL\|query string\|user agent\|referrer" docs/implementation_notes/dashboard-mobile-usage-measurement.md` — confirms the deployed privacy and retention boundaries are recorded.
4. `cd app/backend && pnpm run test:unit -- usage && pnpm run build && pnpm run typecheck:tests` — verifies ingestion, validation, aggregation and test typing without an advisory bypass.
5. `cd app/frontend && pnpm test -- --run src/utils/__tests__/usageAnalytics.test.ts src/pages/__tests__/DashboardPage.usage.test.tsx && pnpm run lint && pnpm run build` — verifies client instrumentation, Dashboard measurement hooks and frontend quality gates.
6. `cd app/frontend && pnpm exec playwright test tests/e2e/dashboard-mobile-usage.spec.ts` — verifies the current mobile navigation/Dashboard fixture, event timing, route transitions, section reach, viewport buckets and no horizontal overflow at the required widths.
7. `grep -n "Evidence_Gate\|approve_change\|collect_more_data\|no_change" docs/implementation_notes/dashboard-mobile-usage-measurement.md` — confirms that a report review decision exists before any approved UI change.

## Requirements

### Requirement 1: Capture the Current State

**User Story:** As a product and engineering team, we want factual evidence of current page and interaction use before changing the Dashboard or mobile navigation.

#### Acceptance Criteria

1. THE team SHALL create a deterministic Measurement_Fixture for the current `DashboardPage.tsx`, `Navigation.tsx`, `MobileTab.tsx` and `MobileDrawer.tsx` without adding a production-only rendering branch.
2. THE Measurement_Fixture SHALL cover widths 320px, 375px, 768px, 1023px, 1024px and 1920px, with representative heights 568px, 667px, 1024px and 1080px, and SHALL set the viewport before navigation.
3. THE baseline SHALL record the current five Mobile_Navigation entry points, More-drawer items, canonical destinations, route transitions, first page-ready timing and page-view events.
4. THE baseline SHALL record each Dashboard_Section's first visible position, whether it is reached before and after scrolling, the first meaningful action available there and relevant Dashboard-related requests.
5. THE baseline SHALL exercise zero and populated robot states, zero and populated notifications, recent and upcoming matches, tournament and standings branches, and loading/error/empty/loaded Overview_Row states where the current components support them.
6. THE baseline SHALL record `scrollHeight`, `clientHeight`, `scrollWidth`, `clientWidth`, section rectangles, first roster-control position and content visible before the first scroll, while retaining the before snapshot unchanged after later work.
7. THE baseline SHALL state fixture assumptions, metric definitions, route-stub limitations and whether any observed behavior could not be measured.

### Requirement 2: Define and Emit First_Party_Telemetry

**User Story:** As an operator, I want consistent events for page use and interaction so that the Current_State_Report measures behavior rather than source-code assumptions.

#### Acceptance Criteria

1. THE client SHALL emit only these event names through the Event_Allowlist: `session_started`, `page_view`, `primary_nav_click`, `more_item_click`, `dashboard_section_impression`, `dashboard_action` and `page_ready`.
2. `session_started` SHALL be emitted once for a new Usage_Session; `page_view` SHALL be emitted for authenticated client-side route transitions and the initial route; `page_ready` SHALL include a bounded client timing value for the canonical route.
3. `primary_nav_click` SHALL identify only an allowlisted Mobile_Navigation button and destination; `more_item_click` SHALL identify only an allowlisted More-drawer item and destination; neither event SHALL accept a label or URL supplied as free text.
4. `dashboard_section_impression` SHALL identify only an allowlisted Dashboard_Section and SHALL deduplicate repeated viewport re-entry within one Dashboard page view; `dashboard_action` SHALL identify only an allowlisted action key and its Source_Surface.
5. Every Usage_Event SHALL contain a random event ID, Usage_Session ID, event name, event timestamp, Canonical_Route, Source_Surface and coarse Device_Bucket/Viewport_Bucket values. The authenticated account association SHALL be derived from the JWT on the server, not accepted from the client payload.
6. The client SHALL handle React Router transitions without relying on document requests and SHALL batch or flush events on route change, page hide and normal application shutdown without blocking navigation.
7. Instrumentation SHALL not change the current Dashboard content, Overview_Row order, Mobile_Navigation buttons, route destinations or visible interaction behavior.

### Requirement 3: Validate, Ingest and Store Usage_Events

**User Story:** As a maintainer, I want a bounded and durable ingestion boundary so that usage data is useful without becoming an unvalidated data sink.

#### Acceptance Criteria

1. THE backend SHALL expose authenticated `POST /api/usage/events` and SHALL validate every event and batch with a strict Zod schema derived from the Event_Allowlist; unknown event names, properties, fields and oversized batches SHALL be rejected.
2. THE ingestion service SHALL enforce a maximum batch size, maximum payload size, bounded string/number values, event timestamp skew limits, per-user rate limiting and idempotent event-ID deduplication.
3. THE backend SHALL persist accepted Usage_Events in a usage-specific store with indexes for event name, canonical route, event time, session and the aggregation dimensions required by the Admin_Report. It SHALL not use `audit_logs`, `financial_ledger`, `EventLogger` or `SecurityMonitor` as the usage store.
4. The server SHALL reject a client-supplied account ID, IP address, user agent, referrer, raw URL, query string, fragment or free-form text field; those values SHALL not be copied into the usage store or application logs.
5. Ingestion failures SHALL be observable to operators without logging event payloads or authentication tokens, and client telemetry failures SHALL not make page navigation or Dashboard rendering fail.
6. The usage store SHALL support deletion or irreversible aggregation at the end of the approved Retention_Window and SHALL expose no user-level raw event export through the Admin_Report.

### Requirement 4: Establish Consent, Retention and Access Boundaries

**User Story:** As a user and operator, I want usage measurement to have an explicit privacy boundary before production collection begins.

#### Acceptance Criteria

1. BEFORE production Usage_Events are collected, the team SHALL record a Consent_Decision naming the collection basis, environments covered, user control, behavior when consent is absent and the owner of the decision.
2. THE client SHALL not send production Usage_Events until the approved Consent_Decision permits collection; test fixtures MAY use an explicit test consent state and SHALL not represent production consent.
3. THE team SHALL record a numeric Retention_Window for raw Usage_Events, the deletion/aggregation mechanism, the treatment of aggregate reports and the owner responsible for verification.
4. Access to raw accepted events SHALL be restricted to the minimum backend/admin roles needed for retention and aggregation; routine Admin_Report responses SHALL contain aggregate counts, rates and timing summaries only.
5. Stored events SHALL contain no passwords, tokens, message text, form values, raw URLs, query strings, fragments, IP addresses, raw user agents, referrers, exact screen dimensions or other unallowlisted personal data.
6. The implementation note SHALL record the data-flow review, consent state, Retention_Window, access roles and known limitations before the Evidence_Gate is opened.

### Requirement 5: Produce the Current_State_Report

**User Story:** As a product owner, I want one factual report showing how users currently navigate and interact with the application so that any later change has an observed reason.

#### Acceptance Criteria

1. THE Admin_Report SHALL report unique Usage_Sessions, page views, route transitions, page-ready timing and event coverage by Measurement_Window, Canonical_Route, Device_Bucket and Viewport_Bucket.
2. THE Admin_Report SHALL report Mobile_Navigation button activations, More-drawer item activations, destination routes, activation share and transition completion without ranking a button as “better” or “worse” without a recorded denominator.
3. THE Admin_Report SHALL report Dashboard_Section impressions, first-reach/scroll-depth buckets, action counts, action rates and the number of sessions that never reached each section.
4. THE Admin_Report SHALL distinguish measured facts from interpretation, identify fixture/production coverage, report missing or rejected event rates and state when sample size is insufficient for a conclusion.
5. THE Admin_Report SHALL be available through an admin-authorized report service/endpoint and an export suitable for the implementation note; it SHALL not require a new player-facing navigation item.
6. THE report SHALL compare the current five Mobile_Navigation buttons and all measured Dashboard_Sections without presuming that any button, section or content block should be removed, moved, collapsed, deferred or added.
7. The first report SHALL be generated only after the documented Measurement_Window has closed and the telemetry validation, privacy and data-quality checks have passed.

### Requirement 6: Enforce the Evidence_Gate Before UI Changes

**User Story:** As a team, we want observed usage to determine whether execution changes the Dashboard or mobile navigation, so that the implementation does not encode an unsupported UX preference.

#### Acceptance Criteria

1. THE Evidence_Gate SHALL review the Current_State_Report and record exactly one outcome: `approve_change`, `collect_more_data` or `no_change`.
2. An `approve_change` outcome SHALL name each Approved_Change, affected surface/files, observed evidence, intended measurable outcome, accessibility/mobile constraints, rollback condition and post-change measurement window.
3. A `collect_more_data` outcome SHALL identify the missing dimension or data-quality defect, the additional collection needed and the condition for reopening the gate; it SHALL prohibit unrelated Dashboard or Mobile_Navigation changes.
4. A `no_change` outcome SHALL record why current behavior is retained and which future question remains unanswered; it SHALL still complete the measurement and documentation work.
5. NO Dashboard content, section order, Overview_Row semantics, Mobile_Navigation button, route destination, notification limit or visible page hierarchy SHALL be changed before the Evidence_Gate record exists.
6. If an Approved_Change is authorized, its implementation SHALL be limited to the recorded scope and SHALL include before/after measurements using the same event definitions and viewport fixture. If no Approved_Change is authorized, no UI optimization code SHALL be added.
7. The Evidence_Gate record SHALL be linked from the implementation note and SHALL be reviewed by the product owner and an engineering owner before execution.

### Requirement 7: Preserve Mobile Measurement Behavior

**User Story:** As a mobile player, I want telemetry to be invisible and non-blocking while the current surface is measured.

#### Acceptance Criteria

1. At every tested width from 320px through 1023px, the existing Mobile_Navigation SHALL remain usable, visually unchanged and free of horizontal overflow; at 1024px and above, its existing visibility behavior SHALL remain unchanged.
2. Measurement code SHALL not add fixed heights, CSS hiding, viewport-specific content branches, navigation controls or additional requests that alter the current page result.
3. Dashboard_Section impressions SHALL work when sections enter the viewport through touch scrolling, keyboard scrolling or assistive technology navigation; the measurement method SHALL not depend on pointer events alone.
4. If the approved Consent_Decision requires a new consent control, that control SHALL be responsive from 320px to 1920px, keyboard accessible, visibly focused and at least 44px by 44px where both dimensions apply.
5. Browser verification SHALL cover 320px, 375px, 768px, 1023px, 1024px and 1920px and SHALL assert `scrollWidth <= clientWidth` for the current fixture.

### Requirement 8: Document the Measurement Contract and Changes

**User Story:** As a maintainer, I want the measurement contract and evidence decision documented so that future work starts from facts rather than stale assumptions.

#### Acceptance Criteria

1. `docs/implementation_notes/dashboard-mobile-usage-measurement.md` SHALL contain the event contract, fixture, viewport matrix, Measurement_Window, Current_State_Report, Consent_Decision, Retention_Window, data-quality results, Evidence_Gate and final decision.
2. `docs/prd_pages/PRD_DASHBOARD_PAGE.md` SHALL be checked and updated only to record the measured current section order, Overview_Row contract, known measurement boundaries and any Approved_Change; it SHALL not contain an unapproved UX recommendation.
3. The navigation documentation inventory SHALL be checked; if no dedicated navigation PRD exists, the implementation note SHALL state that fact rather than inventing a new product requirement.
4. `.kiro/steering/frontend-standards.md`, `.kiro/steering/frontend-state-management.md`, `.kiro/steering/testing-strategy.md` and `.kiro/steering/project-overview.md` SHALL be checked. Any changed reusable telemetry, state, testing or architecture convention SHALL be updated in the specific file; unchanged files SHALL be recorded.
5. `docs/guides/` SHALL be checked for analytics, privacy, Dashboard or navigation guidance. Affected guides SHALL be named and updated; if none applies, the implementation note SHALL record that result.
6. `docs/BACKLOG.md` item #60 SHALL be updated only after the Evidence_Gate and all blocking verification checks pass, with the observed result and any explicitly unanswered question.
7. The requirements, design, tasks and implementation note SHALL use the same event names, domain concepts, code artifact paths and Evidence_Gate outcomes.

### Requirement 9: Run Blocking Verification

**User Story:** As a maintainer, I want the measurement work to fail the build when its contract or privacy boundaries regress.

#### Acceptance Criteria

1. Client unit tests SHALL cover event creation, session lifecycle, route transitions, batching/flush failure behavior, allowlist rejection and deduplication.
2. Backend unit/integration tests SHALL cover authentication-derived ownership, Zod validation, batch and timestamp limits, rate limiting, idempotency, persistence, aggregation, retention and admin authorization.
3. Browser tests SHALL cover the current Mobile_Navigation and Dashboard fixture, all required viewport widths, section reach/action events, route transitions, page-ready events and no horizontal overflow.
4. The implementation SHALL pass the applicable frontend lint/build/unit gates and backend lint/build/test-tier typecheck/unit/integration gates when backend code is changed.
5. No test or workflow step added by this spec SHALL use `continue-on-error`, `|| true`, an unguarded output pipe or another advisory bypass.
6. Final verification SHALL run the Verification Criteria in Expected Contribution and record their results in the implementation note.

## Deliberately Out of Scope

- Selecting a preferred Dashboard content hierarchy before measurement.
- Removing, adding, renaming or reordering the five Mobile_Navigation buttons.
- Replacing the full robot area with a preview, accordion, tab, deferred section or another presentation without an Approved_Change.
- Changing the Overview_Row data contract or Current_Cycle semantics.
- Installing an external analytics provider, SDK, session replay or heatmap tool.
- Making an anonymous tracking system or collecting raw URL, IP, user-agent or referrer data.
- Persisting player-specific navigation preferences before a separate evidence-backed product decision.
