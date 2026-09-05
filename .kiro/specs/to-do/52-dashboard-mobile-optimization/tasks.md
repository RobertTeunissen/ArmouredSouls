# Implementation Plan: Dashboard Mobile Usage Measurement

## Overview

This plan implements Spec 52 in evidence-first order:

1. capture the current Dashboard/Mobile_Navigation surface before instrumentation;
2. add bounded First_Party_Telemetry without changing visible behavior;
3. validate, store and aggregate events under explicit privacy controls;
4. collect the documented Measurement_Window and produce the Current_State_Report;
5. complete the Evidence_Gate; and
6. execute only the recorded Approved_Change, including an explicit no-change branch.

Every task is mandatory. A task with a recorded branch means that the applicable branch must be executed; it is not permission to skip the task. No Dashboard or Mobile_Navigation content/layout change is allowed before the Evidence_Gate record exists.

## Task Dependency Graph

```json
{
  "waves": [
    {"name": "Wave 1 — Current-state baseline", "tasks": ["Task Group 1"]},
    {"name": "Wave 2 — Event contract and client instrumentation", "tasks": ["Task Groups 2 and 3"]},
    {"name": "Wave 3 — Ingestion, storage and privacy", "tasks": ["Task Groups 4 and 5"]},
    {"name": "Wave 4 — Collection and reporting", "tasks": ["Task Group 6"]},
    {"name": "Wave 5 — Evidence gate and recorded execution", "tasks": ["Task Group 7"]},
    {"name": "Wave 6 — Documentation and blocking verification", "tasks": ["Task Groups 8 and 9"]}
  ]
}
```

- Task Group 1 runs against the unchanged visible implementation.
- Task Groups 2 and 3 may not alter the measured content, routes, controls or layout.
- Task Group 4 depends on the shared event contract; Task Group 5 depends on the ingestion boundary.
- Task Group 6 depends on validated production collection and the recorded Consent_Decision/Retention_Window.
- Task Group 7 depends on the Current_State_Report and is the only gate for any later UI behavior change.
- Task Groups 8 and 9 record and verify the final result.

## Tasks

### Task Group 1: Capture the Uninstrumented Current State

_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.2, 7.5, 9.3_

- [ ] 1.1 Inventory the current behavior in `DashboardPage.tsx`, `Navigation.tsx`, `MobileTab.tsx` and `MobileDrawer.tsx`: record the five Mobile_Navigation buttons, More-drawer destinations, below-`lg` visibility boundary, fixed bottom-bar size and current Dashboard_Section order. Record the absence of general usage telemetry and the existing onboarding/audit/security telemetry boundaries.
- [ ] 1.2 Create `app/frontend/tests/e2e/dashboard-mobile-usage.spec.ts` with a deterministic Measurement_Fixture using typed route interception or stable mock responses. Cover zero/populated robots, zero/populated notifications, recent/upcoming matches, tournament and standings branches, supported Overview_Row loading/error/empty/loaded states, all five Mobile_Navigation buttons, representative More items and a populated robot area.
- [ ] 1.3 Add the required viewport matrix—320px, 375px, 768px, 1023px, 1024px and 1920px—with representative heights 568px, 667px, 1024px and 1080px. Set each viewport before navigation and document the mapping used by the fixture.
- [ ] 1.4 Add the uninstrumented baseline harness for `scrollHeight`, `clientHeight`, `scrollWidth`, `clientWidth`, Dashboard_Section rectangles, first roster-control position, content before the first scroll, first section reach and relevant request timestamps.
- [ ] 1.5 Run the fixture against the unchanged visible implementation before adding production instrumentation. Preserve the result in `docs/implementation_notes/dashboard-mobile-usage-measurement.md` under a clearly labelled pre-instrumentation snapshot.
- [ ] 1.6 Record current route transitions, page-ready measurement limitations, section reach/action limitations and relevant child requests. State explicitly that the current event stream is absent rather than fabricating events from request logs.
- [ ] 1.7 Assert `scrollWidth <= clientWidth` at every required width as a baseline fact. Do not alter CSS, section order, navigation controls or content to make this assertion pass.

### Task Group 2: Define the Shared Usage Event Contract

_Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 3.1, 7.2, 9.1, 9.2_

- [ ] 2.1 Create `app/shared/types/usageEvents.ts` with the seven event names: `session_started`, `page_view`, `primary_nav_click`, `more_item_click`, `dashboard_section_impression`, `dashboard_action` and `page_ready`.
- [ ] 2.2 Define the discriminated payload types and finite values for `navItem`, `sectionId`, `reachBucket`, `navigationKind`, `deviceBucket`, `viewportBucket`, `actionKey`, `moreItem` and `sourceSurface`. Include `eventId`, `sessionId`, `occurredAt`, `canonicalRoute` and the bounded event-specific fields. Do not add a JSON or free-form metadata field.
- [ ] 2.3 Define canonical route normalization and the width-to-Viewport_Bucket map, including the 320px, 375px, 768px, 1023px, 1024px and 1920px boundaries. Ensure exact dimensions are not part of the stored event contract.
- [ ] 2.4 Add shared contract tests for every allowlisted event, every finite key, malformed route rejection and disallowed properties. Keep the seven event names identical across frontend, backend, requirements, design and implementation note.
- [ ] 2.5 Record the contract and its extension rule in `docs/implementation_notes/dashboard-mobile-usage-measurement.md`. Adding an event or property requires a shared type, validator, report field and test update.

### Task Group 3: Instrument the Existing Frontend Without Visible Changes

_Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3, 7.4, 9.1, 9.3_

- [ ] 3.1 Create `app/frontend/src/utils/usageAnalytics.ts` with explicit consent enable/disable state, random `sessionId`/`eventId` creation, session idle handling, canonical route normalization, allowlist enforcement, bounded batching and non-blocking flush behavior.
- [ ] 3.2 Store only the random Usage_Session identifier in `sessionStorage`; do not store account IDs or personal data in the collector. Emit `session_started` once per new session and `page_view` for the initial route and authenticated React Router transitions.
- [ ] 3.3 Integrate route observation and page-ready timing in the existing authenticated application shell. Emit `page_ready` with bounded `readyMs` without depending on document requests or delaying navigation.
- [ ] 3.4 Instrument existing activation handlers in `Navigation.tsx`, `MobileTab.tsx` and `MobileDrawer.tsx` for `primary_nav_click` and `more_item_click`. Use only fixed keys and existing destinations; do not add, remove, rename or reorder controls.
- [ ] 3.5 Add stable non-visual `data-usage-section` markers to the existing Dashboard sections and a shared observer that emits one `dashboard_section_impression` per section per Dashboard page view with its reach bucket. Add `dashboard_action` at existing allowlisted Dashboard actions without changing their behavior.
- [ ] 3.6 Flush on bounded batch threshold, short timer, route change and `pagehide` using `fetch` keepalive or `navigator.sendBeacon`; swallow telemetry failures after local diagnostics so Dashboard rendering and navigation cannot fail.
- [ ] 3.7 Create `app/frontend/src/utils/__tests__/usageAnalytics.test.ts` covering consent-disabled behavior, session lifecycle, route transitions, allowlists, batch/flush behavior, page-hide failure, duplicate suppression, canonical routes and no payload identity fields.
- [ ] 3.8 Create `app/frontend/src/pages/__tests__/DashboardPage.usage.test.tsx` covering stable section markers, one impression per section per Dashboard page view, fixed action keys, current section order and no visible-content/layout changes from instrumentation.

### Task Group 4: Add Validated Ingestion and Durable Usage Storage

_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.2, 9.4, 9.5_

- [ ] 4.1 Add the typed Prisma `UsageEvent` model mapped to `usage_events` with server-derived `userId`, client event/session IDs, event timestamps, canonical/source/bucket columns and nullable allowlisted event-specific scalar columns. Add `(userId, eventId)` uniqueness and report indexes.
- [ ] 4.2 Create and apply the migration, regenerate the project-local Prisma client and verify that no foreign keys to Dashboard or player-owned resources are introduced. Do not route usage records through `audit_logs`, `financial_ledger`, `EventLogger` or `SecurityMonitor`.
- [ ] 4.3 Create the strict Zod request schema under `app/backend/src/schemas/` and the thin authenticated usage route for `POST /api/usage/events`. Reject unknown fields/event names, malformed event-specific fields and oversized batches.
- [ ] 4.4 Implement `app/backend/src/services/usage/usageEventService.ts` with maximum 50 events, maximum 64 KiB request size, 100-character bounded strings, `readyMs` 0–600,000, client timestamp skew of 15 minutes, per-user rate limiting, server JWT ownership and idempotent `(userId, eventId)` deduplication.
- [ ] 4.5 Return accepted/duplicate/rejected counts without returning stored event data. Log only status/count diagnostics; do not log payloads, tokens, IP addresses, user agents, referrers or raw URLs. Ensure client ingestion failure cannot fail a page request.
- [ ] 4.6 Add backend tests for authentication-derived ownership, strict validation, unknown fields, size/count/timestamp limits, rate limiting, duplicate IDs, persistence mapping, standard errors and absence of usage payloads in logs.

### Task Group 5: Establish Consent, Retention and Admin Access Controls

_Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.4, 8.5, 9.2, 9.4_

- [ ] 5.1 Record the Consent_Decision in the implementation note before production collection: collection basis, environments, user control, absent-consent behavior, owner and approval date. Keep production collection disabled until this record permits it; use an explicit test consent state only in the Measurement_Fixture.
- [ ] 5.2 Set and record the numeric Retention_Window, its configuration key, deletion/irreversible-aggregation mechanism, aggregate treatment and verification owner. Implement the scheduled retention service and a test that proves raw Usage_Events are removed or irreversibly aggregated at the boundary.
- [ ] 5.3 Verify that stored rows contain only typed allowlisted fields and no passwords, tokens, message text, form values, raw URLs, query strings, fragments, IP addresses, raw user agents, referrers, exact dimensions or free-form data.
- [ ] 5.4 Integrate admin authorization for the report endpoint and define the minimum role access. Confirm that routine Admin_Report responses contain aggregate data only and no user-level raw event export.
- [ ] 5.5 Check `.kiro/steering/frontend-standards.md`, `.kiro/steering/frontend-state-management.md`, `.kiro/steering/testing-strategy.md`, `.kiro/steering/project-overview.md` and `docs/guides/` for consent, telemetry, privacy, state, testing or architecture conventions. Record each file's changed/unchanged result in the implementation note.
- [ ] 5.6 Add backend tests for retention, admin authorization, aggregate-only response shape, consent-disabled ingestion behavior and privacy field exclusion.

### Task Group 6: Collect Usage and Produce the Current_State_Report

_Requirements: 1.3, 1.4, 1.6, 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.1, 7.3, 9.3_

- [ ] 6.1 Create `app/backend/src/services/usage/usageReportService.ts` with aggregate queries for sessions, page views, route transitions, page-ready timing, Mobile_Navigation activation/destination completion, More-drawer use, Dashboard_Section reach/action rates and sessions not reaching sections.
- [ ] 6.2 Add the admin-authorized `GET /api/admin/usage/report` route with validated dates and `json`/`csv` output selection. Return denominators, accepted/rejected/duplicate/missing event counts, fixture/production source and Measurement_Window; never return raw event rows.
- [ ] 6.3 Run the instrumented Measurement_Fixture at 320px, 375px, 768px, 1023px, 1024px and 1920px. Verify current five-button behavior, More-drawer events, route transitions, page-ready events, section reach/action events, request/event ordering, repeated section entry and `scrollWidth <= clientWidth`.
- [ ] 6.4 Open the documented production Measurement_Window only after Task Group 5's Consent_Decision and Retention_Window checks pass. Record collection start/end, version, event coverage and any outage or missing-data period.
- [ ] 6.5 Generate the Admin_Report and export the aggregate data into `docs/implementation_notes/dashboard-mobile-usage-measurement.md`. Separate observed facts, denominators, interpretations, missing data and sample-size limitations; do not recommend a UI change in the report itself.
- [ ] 6.6 Verify that report output compares all five Mobile_Navigation buttons and all measured Dashboard_Sections without ranking or presuming a preferred outcome.

### Task Group 7: Complete and Execute the Evidence_Gate Outcome

_Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.3, 7.4, 7.5, 9.3_

- [ ] 7.1 Review the Current_State_Report with a product owner and an engineering owner. Record exactly one outcome in the implementation note: `approve_change`, `collect_more_data` or `no_change`, with date and reviewers.
- [ ] 7.2 For `approve_change`, record each Approved_Change, exact affected files/surfaces, observed evidence, measurable outcome, mobile/accessibility constraints, rollback condition and post-change Measurement_Window before modifying UI behavior.
- [ ] 7.3 For `collect_more_data`, record the missing dimension or data-quality defect, additional collection required and reopening condition; collect only that data and keep unrelated Dashboard/Mobile_Navigation behavior unchanged.
- [ ] 7.4 For `no_change`, record why the current behavior is retained and which question remains unanswered; make no UI optimization change and complete the documentation/verification tasks.
- [ ] 7.5 Execute the recorded branch. If `approve_change` is recorded, implement only its named scope, preserve the current Overview_Row/Current_Cycle contract and add tests for its exact behavior. If `collect_more_data` or `no_change` is recorded, verify that no unapproved UI/layout/navigation change exists.
- [ ] 7.6 If the approved scope adds or changes controls, verify semantic names, keyboard access, visible focus, no hidden focusable content, no horizontal overflow from 320px through 1920px and 44px by 44px Activation_Region where both dimensions apply. If it introduces tabs, use the responsive tab pattern in `.kiro/steering/frontend-standards.md` and the existing 1024px boundary.
- [ ] 7.7 Repeat the same fixture and report comparison for an approved change, or record the unchanged comparison for the other outcomes. Do not claim improvement without before/after measurements using the same event definitions and viewport fixture.

### Task Group 8: Complete Documentation and Backlog Traceability

_Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 6.2, 6.7_

- [ ] 8.1 Complete `docs/implementation_notes/dashboard-mobile-usage-measurement.md` with the shared event contract, fixture, viewport matrix, uninstrumented baseline, Consent_Decision, Retention_Window, Measurement_Window, Admin_Report export, data-quality results, Evidence_Gate, before/after result and known limitations.
- [ ] 8.2 Check and update `docs/prd_pages/PRD_DASHBOARD_PAGE.md` only for the measured current section order, Overview_Row contract, known measurement boundaries and the recorded Approved_Change. Remove or mark stale claims; do not add an unapproved UX recommendation.
- [ ] 8.3 Check for a dedicated navigation PRD and record the exact result in the implementation note. Do not create a navigation product requirement solely because the inventory is empty.
- [ ] 8.4 Update only the applicable files among `.kiro/steering/frontend-standards.md`, `.kiro/steering/frontend-state-management.md`, `.kiro/steering/testing-strategy.md` and `.kiro/steering/project-overview.md`, naming the changed convention; record unchanged files explicitly.
- [ ] 8.5 Check `docs/guides/` for analytics, privacy, Dashboard or navigation guides. Update each affected guide by exact filename, or record that no guide applies.
- [ ] 8.6 Update `docs/BACKLOG.md` item #60 only after the Evidence_Gate and final blocking checks pass. Record the observed outcome and any unanswered question or deferred work.
- [ ] 8.7 Search the spec, implementation note, PRD and changed code for consistent event names, domain concepts, code paths and Evidence_Gate outcomes. Correct terminology drift before verification.

### Task Group 9: Run Final Blocking Verification

_Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6; Verification Criteria 1–7_

- [ ] 9.1 Run Verification Criterion 1: confirm all seven event names have frontend/backend implementation references.
- [ ] 9.2 Run Verification Criterion 2: confirm `usageAnalytics.ts`, `usageEventService.ts`, `usageReportService.ts` and `docs/implementation_notes/dashboard-mobile-usage-measurement.md` exist.
- [ ] 9.3 Run Verification Criterion 3: confirm the implementation note records Consent_Decision, Retention_Window, raw-data exclusions and access boundaries.
- [ ] 9.4 Run Verification Criteria 4 and 5: run the applicable backend/frontend focused tests, lint, build, test-tier typecheck and required unit/integration gates. Use no `continue-on-error`, `|| true`, unguarded pipe or other advisory bypass.
- [ ] 9.5 Run Verification Criterion 6: run `app/frontend/tests/e2e/dashboard-mobile-usage.spec.ts` at every required width and record route, section, timing, event, mobile and overflow results.
- [ ] 9.6 Run Verification Criterion 7: confirm the implementation note contains exactly one Evidence_Gate outcome and that the outcome precedes any Approved_Change.
- [ ] 9.7 Review all requirements against the final implementation note and changed-file list. Do not mark the spec complete while a criterion is unverified, a privacy owner is missing, a report denominator is absent or an unapproved UI change is present.

## Requirements Coverage Matrix

| Requirement acceptance criteria | Task groups |
|---|---|
| 1.1–1.7 | 1, 6 |
| 2.1–2.7 | 2, 3 |
| 3.1–3.6 | 2, 4 |
| 4.1–4.6 | 5 |
| 5.1–5.7 | 6 |
| 6.1–6.7 | 7, 8 |
| 7.1–7.5 | 1, 3, 6, 7, 8 |
| 8.1–8.7 | 5, 8 |
| 9.1–9.6 | 2, 3, 4, 5, 6, 7, 9 |

Every acceptance criterion is assigned to at least one mandatory task group. Verification Criteria 1–7 are assigned to Task Group 9.

## Notes

- Spec number 52 is global; backlog item #60 is a separate identifier.
- The first implementation checkpoint is the uninstrumented current-state baseline, not a visual redesign.
- The five current Mobile_Navigation buttons and all Dashboard content remain unchanged until the Evidence_Gate.
- The final result may be an evidence-backed UI change, additional measurement, or documented no change. All three outcomes complete the required decision process; only the recorded outcome determines execution.
