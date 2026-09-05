# Design Document

## Overview

Spec 52 is an evidence and measurement implementation for backlog item #60. It does not select a preferred Dashboard hierarchy or mobile-navigation design. The first phase adds minimal First_Party_Telemetry to the existing surfaces, stores bounded events, produces a Current_State_Report and opens an Evidence_Gate. A later phase may implement only the Approved_Change recorded by that gate; `no_change` is a valid completed outcome.

The data path is:

```text
existing React surfaces
  -> usageAnalytics.ts
  -> authenticated POST /api/usage/events
  -> Zod allowlist + limits + deduplication
  -> `UsageEvent` / `usage_events`
  -> usageReportService.ts
  -> admin-authorized GET /api/admin/usage/report
  -> Current_State_Report and Evidence_Gate record
```

Telemetry is separate from game audit and security monitoring. It is first-party, authenticated, aggregate-oriented and disabled until the Consent_Decision permits production collection.

## Existing Gap and Current Surface

### Verified repository findings

- There is no general page-view, route-transition, session, navigation or Dashboard-section telemetry.
- `app/frontend/src/utils/onboardingAnalytics.ts` measures onboarding only and is not a general usage store.
- `app/backend/src/services/common/eventLogger.ts` writes game-domain `AuditLog` records with cycle/sequence semantics; it is not a page-usage source.
- `app/backend/src/services/security/securityMonitor.ts` is security-only and is not a durable usage store.
- Request logs cannot measure React Router transitions that do not load a document.
- `app/backend/prisma/schema.prisma` has no usage-event, consent or analytics-preference model.
- `Navigation.tsx` renders the current below-`lg` Mobile_Navigation: Dashboard `/dashboard`, Robots `/robots`, Battles `/battle-history`, Shop `/weapon-shop` and More. The mobile wrapper is `lg:hidden`, so the current boundary is below 1024px. The fixed bottom bar is `h-16` (64px); the More drawer close button is currently `w-8 h-8` (32px).
- `DashboardPage.tsx` currently composes the notification stack, `OverviewRow`, Recent Battles, Upcoming Matches when applicable, tournament content, standings and the My Robots area. No conclusion about their value or order is made here.

These findings define what must be measured. They do not define what must be redesigned.

## Architecture and File Responsibilities

### Shared event contract

Create `app/shared/types/usageEvents.ts` for the finite event names, route/surface keys, bucket values and discriminated payload types shared by the frontend and backend. The contract contains only bounded scalar fields; it does not contain a JSON escape hatch or free-form metadata.

The seven accepted event names and their event-specific fields are:

| Event name | Required measured fields | Emission rule |
|---|---|---|
| `session_started` | base fields | Once when a new random Usage_Session is created. |
| `page_view` | `previousRoute` when a prior route exists, `navigationKind` | Initial route and every authenticated React Router transition. |
| `primary_nav_click` | `navItem`, `destinationRoute` | Existing Mobile_Navigation button activation only. |
| `more_item_click` | `moreItem`, `destinationRoute` | Existing More-drawer item activation only. |
| `dashboard_section_impression` | `sectionId`, `reachBucket` | First viewport entry for an allowlisted Dashboard_Section during one Dashboard page view. |
| `dashboard_action` | `actionKey`, `sourceSurface` | Existing allowlisted Dashboard action activation. |
| `page_ready` | bounded `readyMs` | Once after the current route has rendered its measurable ready state. |

Every event also carries `eventId`, `sessionId`, `eventName`, `occurredAt`, `canonicalRoute`, `sourceSurface`, `deviceBucket` and `viewportBucket`. The client never sends `userId`; the authenticated route derives it from the JWT. `previousRoute` is normalized to a Canonical_Route and is omitted on the first route.

The initial allowlists are:

- `navItem`: `dashboard`, `robots`, `battles`, `shop`, `more`.
- `sectionId`: `notifications`, `overview_row`, `recent_battles`, `upcoming_matches`, `active_tournament`, `league_standings`, `my_robots`.
- `reachBucket`: `initial`, `after_first_scroll`, `after_25_percent`, `after_50_percent`, `after_75_percent`, `after_100_percent`.
- `navigationKind`: `initial`, `router`.
- `deviceBucket`: `phone`, `tablet`, `desktop`, `unknown`.
- `viewportBucket`: `phone_small`, `phone`, `tablet`, `desktop`, `wide_desktop`, `unknown`.
- `actionKey`, `moreItem` and `sourceSurface`: finite values declared in the shared contract and extended only through a code review that updates tests and the report.

Viewport_Bucket is derived locally from width ranges that include 320px, 375px, 768px, 1023px, 1024px and 1920px. Exact dimensions are never persisted. The bucket map is documented in the implementation note and used identically by the fixture and production collector.

### Frontend collector

Create `app/frontend/src/utils/usageAnalytics.ts` as a small, page-independent collector. It owns:

1. explicit enable/disable state supplied by the approved Consent_Decision;
2. random `sessionId` storage in `sessionStorage` and an idle-session boundary recorded in the implementation note;
3. random `eventId` creation and an in-memory sent/deduplication set;
4. canonical pathname normalization and allowlisted source/route values;
5. batching at a bounded event count or short flush interval;
6. non-blocking `fetch` with `keepalive` or `navigator.sendBeacon` on page hide, with failures swallowed after local diagnostics; and
7. no account ID, raw URL, query string, fragment, referrer, user agent or free-form property collection.

A route-level integration in the existing authenticated application shell observes React Router location changes. It emits `page_view` and starts the page-ready timer without relying on document requests. `Navigation.tsx`, `MobileTab.tsx` and `MobileDrawer.tsx` call the collector at their existing activation handlers; they do not gain new buttons, labels or destinations.

`DashboardPage.tsx` and the existing Dashboard section components add stable non-visual measurement markers such as `data-usage-section`. A shared observer helper under `app/frontend/src/utils/` emits one `dashboard_section_impression` per section per Dashboard page view and records the reach bucket. Existing buttons and links emit `dashboard_action` using fixed action keys. CSS hiding, new wrappers that affect layout, deferred mounting and content changes are not part of this instrumentation phase.

### Backend ingestion

Create:

- `app/backend/src/types/usageEvents.ts` for backend-facing typed event/report shapes where the shared contract is insufficient.
- `app/backend/src/services/usage/usageEventService.ts` for validation mapping, deduplication, persistence and ingestion diagnostics.
- `app/backend/src/services/usage/usageReportService.ts` for aggregate queries and report formatting.
- A usage route module integrated with the existing route registration for authenticated `POST /api/usage/events` and admin-authorized `GET /api/admin/usage/report`.
- A route schema module under `app/backend/src/schemas/` using `validateRequest`; route handlers remain thin.

`POST /api/usage/events` accepts `{ events: [...] }`. Authentication runs before the per-user usage limiter. The schema is strict and rejects unknown keys, event names, event-specific keys and malformed canonical routes. Starting limits are a maximum of 50 events and 64 KiB encoded request size; individual strings are bounded at 100 characters, and `readyMs` is an integer from 0 through 600,000. Client timestamps must be within 15 minutes of server time. These limits are constants in the schema/service and are covered by tests.

The route responds with accepted, duplicate and rejected counts without returning stored event data. A duplicate `(userId, eventId)` is idempotently ignored. An event ID collision for a different authenticated account is not treated as a successful duplicate. Client failures never reject the page transition or Dashboard render.

### Storage

Add a Prisma `UsageEvent` model mapped to `usage_events`. Use typed scalar columns rather than a free-form JSON payload:

- internal row ID;
- server-derived `userId`;
- client `eventId` and random `sessionId`;
- `eventName`, `occurredAt` and server `receivedAt`;
- `canonicalRoute`, optional `previousRoute` and `sourceSurface`;
- `deviceBucket` and `viewportBucket`;
- nullable allowlisted columns for `navItem`, `moreItem`, `destinationRoute`, `sectionId`, `reachBucket`, `actionKey`, `navigationKind` and `readyMs`.

Add a unique constraint for `(userId, eventId)` and indexes for `eventName`, `occurredAt`, `userId/sessionId`, `canonicalRoute` and the report dimensions. Do not add foreign keys from usage data into Dashboard content or player-owned resources. Do not write these rows to `audit_logs`, `financial_ledger` or security-monitor storage.

The retention service deletes raw rows or irreversibly aggregates them at the approved Retention_Window. The implementation note records which method is used and how it was verified. The first report has no user-level raw event export.

## Consent, Privacy and Security

The collector defaults to disabled for production until a Consent_Decision is recorded. The decision must specify the collection basis, environments, user control, absent-consent behavior and owner. A test fixture may pass an explicit test consent state; that state is not evidence of production consent. If the decision requires a new player-facing consent control, that control is a separate visible change and must meet the mobile/accessibility rules in the requirements before production collection begins.

The request contains only the allowlisted event contract. The server owns account association and timestamps received for retention/audit purposes. It rejects client-supplied identity, IP, user-agent, referrer, raw URL, query string, fragment, token, password, form value and free-form text fields. Application logs contain status/count diagnostics only, never payloads or tokens.

The usage endpoint uses the existing authentication and error middleware, strict Zod validation, a per-user rate limiter, bounded request sizes and timestamp skew checks. The admin report endpoint uses the existing admin authorization and returns aggregate counts, rates and timing summaries. Raw event rows are not exposed to routine administrators through this report.

The numeric Retention_Window, deletion/aggregation job, access roles and verification owner are recorded before the Evidence_Gate opens. No legal or product assumption is hidden in the collector; the Consent_Decision is an explicit prerequisite.

## Measurement_Fixture and Current-State Collection

The fixture lives with the Playwright tests and uses stable route interception or typed mock responses. It must not add a production-only branch. It covers:

- zero and populated robots;
- zero and populated notifications;
- recent and upcoming matches;
- tournament and standings branches;
- loading, error, empty and loaded Overview_Row states supported by the current components;
- all five Mobile_Navigation buttons and representative More-drawer items; and
- the existing Dashboard section order and a populated robot area.

The viewport matrix is:

| Width | Current surface being measured | Representative height |
|---:|---|---:|
| 320px | smallest supported phone and bottom navigation | 568px |
| 375px | common phone and bottom navigation | 667px |
| 768px | tablet-width mobile navigation | 1024px |
| 1023px | last width below `lg` | 1024px |
| 1024px | first width at/above `lg` | 1024px |
| 1920px | wide desktop regression | 1080px |

The fixture sets the viewport before navigation. It records `scrollHeight`, `clientHeight`, `scrollWidth`, `clientWidth`, section rectangles, first roster-control position, content before the first scroll, first section reach, relevant request timestamps and emitted Usage_Events. The same metric definitions and route stubs are used for the final comparison. Requests are counted to document current behavior, not to justify an unselected optimization.

A `dashboard-mobile-usage.spec.ts` browser test captures the baseline event stream and measurements. Client unit tests cover the collector independently from the browser. The fixture asserts `scrollWidth <= clientWidth` as a current-state regression check; it does not change the layout to make the assertion pass.

## Current_State_Report and Admin_Report

`usageReportService.ts` groups accepted events by Measurement_Window, Canonical_Route, Device_Bucket and Viewport_Bucket. `GET /api/admin/usage/report` accepts validated report dates and an optional output format (`json` or `csv`) and returns aggregate data only.

The report contains:

1. unique Usage_Sessions, page views, route transitions, page-ready count and p50/p75/p95 `readyMs` by route and bucket;
2. Mobile_Navigation activation count, distinct activating sessions, click share among observed navigation clicks, mobile-session reach denominator and destination completion;
3. More-drawer item activation count and destination completion;
4. Dashboard_Section impression count, distinct sessions, first-reach/scroll-depth buckets, action counts and action rate among sessions with an impression;
5. sessions with a Dashboard page view that did not emit an impression for each section;
6. accepted, rejected, duplicate, missing and malformed event counts; and
7. fixture versus production source and the exact Measurement_Window.

The report labels denominators and separates observed fact from interpretation. It may state that data is insufficient; it must not call a button or section “better,” “worse,” “important” or “unused” without the recorded denominator and review context. It does not recommend a particular section or button outcome.

The implementation note stores the exported aggregate report, metric definitions, data-quality results, limitations and a concise factual interpretation. It does not store user-level event rows.

## Evidence_Gate and Execution Flow

The sequence is mandatory:

1. implement and validate the collector, ingestion, storage and report without changing visible Dashboard or Mobile_Navigation behavior;
2. record the Consent_Decision and Retention_Window;
3. collect the documented Measurement_Window;
4. run data-quality checks and generate the Current_State_Report/Admin_Report;
5. review the report with a product owner and engineering owner; and
6. record exactly one Evidence_Gate outcome: `approve_change`, `collect_more_data` or `no_change`.

For `approve_change`, the record names the exact surface/files, observed facts, measurable outcome, mobile/accessibility constraints, rollback condition and post-change Measurement_Window. The implementation then changes only that scope and repeats the same fixture/report comparison. For `collect_more_data`, the record names the missing dimension or defect and blocks unrelated UI changes. For `no_change`, the current UI remains as measured and the unanswered question is documented. This spec selects no unmeasured layout or information-architecture policy.

The Evidence_Gate is a product/engineering decision record, not a heuristic implemented in the client. The implementation note links it to the report and records the approval owners and date.

## Mobile Responsiveness and Accessibility

The measurement phase preserves the current responsive contract: the existing below-`lg` Mobile_Navigation is measured from 320px through 1023px, the current `lg` boundary is measured at 1024px, and the desktop surface is checked at 1920px. Instrumentation uses non-visual markers and existing handlers; it does not alter the 64px bottom bar, current destinations or current control sizes.

The browser fixture uses touch-capable scrolling and keyboard navigation where supported so section impressions are not pointer-only. It checks no horizontal overflow at every required width. No new tab or tab-like navigation is introduced by measurement. If a later Approved_Change introduces tabs, the implementation must use the established responsive tab layout pattern in `.kiro/steering/frontend-standards.md` and the existing 1024px convention rather than inventing a second breakpoint. Any new consent or approved interaction control must have a visible focus state, semantic name and a 44px by 44px Activation_Region where both dimensions apply.

## Failure Handling and Observability

Telemetry is best effort from the page's perspective. A failed flush is counted locally and can be reported as an ingestion-health metric without retrying indefinitely. Backend validation and persistence failures return the standard error shape and are logged with route/status context but without payloads. Duplicate events are not errors visible to the player. Report queries fail closed for unauthorized callers and validate all date/format input.

The collector must not make Dashboard data loading, React Router navigation or the fixed mobile navigation depend on telemetry success. No error fallback may replace existing Dashboard content because of a usage event failure.

## Test and Quality Design

### Client tests

`app/frontend/src/utils/__tests__/usageAnalytics.test.ts` covers event allowlists, canonical route normalization, random session/event IDs, session lifecycle, batching, page-hide flush, route transitions, consent-disabled behavior, invalid property rejection, duplicate suppression and failed-send handling.

`app/frontend/src/pages/__tests__/DashboardPage.usage.test.tsx` covers stable section markers, one impression per section per Dashboard page view, action keys, current section order and no visible-content changes attributable to instrumentation.

### Backend tests

Backend unit tests cover strict Zod schemas, event-specific allowlists, batch/payload/timestamp limits, server-derived account association, duplicate IDs, persistence mapping, aggregation denominators, retention and admin authorization. Integration tests exercise `POST /api/usage/events` and `GET /api/admin/usage/report` against the project database when the backend tier is available.

### Browser tests

`app/frontend/tests/e2e/dashboard-mobile-usage.spec.ts` runs the Measurement_Fixture at all six widths and required heights. It verifies current five-button Mobile_Navigation behavior, More-drawer events, route transitions, page-ready events, Dashboard_Section reach/action events, request/event ordering, repeated section entry, content-before-scroll metrics and `scrollWidth <= clientWidth`.

All applicable lint, build, typecheck, unit, integration and browser gates remain blocking. No new test or workflow command uses `continue-on-error`, `|| true`, an unguarded pipe or another bypass.

## Documentation Impact

The implementation must update or explicitly check these files:

- `docs/implementation_notes/dashboard-mobile-usage-measurement.md`: event contract, fixture, viewport matrix, Measurement_Window, report export, consent/retention/data-quality results, Evidence_Gate and before/after outcome.
- `docs/prd_pages/PRD_DASHBOARD_PAGE.md`: current measured section order and Overview_Row contract; update only approved changes and remove/mark stale claims without adding an unapproved recommendation.
- Navigation documentation inventory: identify whether a dedicated navigation PRD exists; if none exists, record that fact in the implementation note rather than creating a speculative product document.
- `.kiro/steering/frontend-standards.md`: update only if a reusable telemetry or responsive interaction convention changes; otherwise record checked/unchanged.
- `.kiro/steering/frontend-state-management.md`: update only if telemetry state becomes cross-page shared state; the collector is a module boundary and should not add a Zustand store without evidence.
- `.kiro/steering/testing-strategy.md`: record the reusable viewport/telemetry fixture convention if it is established.
- `.kiro/steering/project-overview.md`: update only if the usage service or shared event contract becomes a documented architecture component.
- `docs/guides/`: check for analytics, privacy, Dashboard or navigation guidance; update a named affected guide or record that none applies.
- `docs/BACKLOG.md`: update item #60 only after the Evidence_Gate and blocking verification pass.

## Requirements Traceability

| Requirement | Design coverage |
|---|---|
| 1.1–1.7 Current state | § Existing Gap and Current Surface; § Measurement_Fixture and Current-State Collection |
| 2.1–2.7 First_Party_Telemetry | § Shared event contract; § Frontend collector |
| 3.1–3.6 Ingestion/storage | § Backend ingestion; § Storage; § Failure Handling and Observability |
| 4.1–4.6 Consent/privacy/retention | § Consent, Privacy and Security; § Documentation Impact |
| 5.1–5.7 Reporting | § Current_State_Report and Admin_Report |
| 6.1–6.7 Evidence_Gate | § Evidence_Gate and Execution Flow |
| 7.1–7.5 Mobile measurement | § Mobile Responsiveness and Accessibility; § Measurement_Fixture and Current-State Collection |
| 8.1–8.7 Documentation | § Documentation Impact; § Evidence_Gate and Execution Flow |
| 9.1–9.6 Blocking verification | § Test and Quality Design; § Failure Handling and Observability |

Each row covers the acceptance criteria in the corresponding requirement. Documentation-only criteria are explicitly covered by Documentation Impact.

## Deliberately Out of Scope

- Choosing a preferred Dashboard content hierarchy or mobile-navigation arrangement before the Evidence_Gate.
- Adding, removing, renaming or reordering the five current Mobile_Navigation buttons without an Approved_Change.
- Replacing the robot area, notifications, battles, tournaments or standings with a preview, tab, accordion or deferred section without an Approved_Change.
- Changing `GET /api/dashboard/current-cycle`, Current_Cycle meaning or Overview_Row data semantics.
- Installing an external analytics provider, SDK, session replay, heatmap or anonymous tracking system.
- Persisting player-specific navigation preferences before a separate evidence-backed decision.
