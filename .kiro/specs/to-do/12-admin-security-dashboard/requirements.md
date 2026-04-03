# Requirements Document

## Introduction

This document defines the requirements for a Security Dashboard tab in the Armoured Souls admin portal. Spec 11 (Security Audit Guardrails) added backend security monitoring with two admin API endpoints (`GET /api/admin/security/events` and `GET /api/admin/security/summary`) and an in-memory circular buffer of 500 security events. However, no frontend UI was built to consume these APIs, leaving admins unable to view security data without SSH access or raw API calls. This spec closes that gap by adding a dedicated "Security" tab to the existing admin portal.

## Glossary

- **SecurityEvent**: A structured JSON object emitted by the backend `SecurityMonitor` containing `severity`, `eventType`, `userId`, `sourceIp`, `endpoint`, `details`, and `timestamp`
- **SecuritySeverity**: One of `info`, `warning`, or `critical` — the severity level of a security event
- **SecuritySummary**: The aggregate response from `GET /api/admin/security/summary` containing `totalEvents`, `bySeverity` counts, `activeAlerts` count, and `flaggedUserIds` array
- **Admin Portal**: The `/admin` page in the frontend, currently an 8-tab interface (Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, Bankruptcy Monitor, Recent Users, Repair Log)
- **Circular Buffer**: The in-memory ring buffer of the last 500 security events maintained by the backend `SecurityMonitor` singleton

## Expected Contribution

This spec delivers a usable frontend for the security monitoring APIs that were built in spec 11 but left without a UI.

1. Admins can view security event data directly in the admin portal instead of requiring SSH access or curl — going from 0 UI visibility to full dashboard visibility of the last 500 events
2. The admin portal gains a 9th tab ("Security") following the existing decomposed tab architecture, keeping the codebase consistent
3. Critical and warning alerts are surfaced with visual prominence (color-coded severity indicators), reducing mean time to notice security anomalies from "whenever someone checks logs" to "next time an admin opens the portal"
4. Filtering by severity, event type, user ID, and time range is available in the UI, matching the backend API's existing filter capabilities
5. A summary panel shows at-a-glance counts (total events, alerts by severity, flagged users), giving admins a quick security health check without scrolling through individual events

### Verification Criteria

1. `grep -r "SecurityTab" prototype/frontend/src/components/admin/ | wc -l` — returns ≥ 2 (component file + barrel export)
2. `grep "'security'" prototype/frontend/src/pages/AdminPage.tsx | wc -l` — returns ≥ 1 (tab registered in admin shell)
3. `ls prototype/frontend/src/components/admin/__tests__/SecurityTab.test.tsx` — file exists
4. The Security tab renders a summary panel with severity counts and a filterable event table when the backend returns data
5. The Security tab renders a meaningful zero-state when the backend returns no events
6. `grep -r "security/events\|security/summary" prototype/frontend/src/components/admin/SecurityTab.tsx | wc -l` — returns ≥ 2 (both API endpoints consumed)

## Requirements

### Requirement 1: Security Tab Registration in Admin Portal

**User Story:** As an admin, I want a "Security" tab in the admin portal navigation, so that I can access security monitoring data alongside other admin tools.

#### Acceptance Criteria

1. THE Admin Portal SHALL include a "Security" tab in the tab navigation bar, displayed with a shield icon (🛡️) and the label "Security"
2. THE Security tab SHALL follow the existing admin tab architecture: a dedicated component in `components/admin/`, exported via the barrel `index.ts`, and rendered by the `AdminPage` shell
3. THE Security tab SHALL persist its selection in localStorage and URL hash, consistent with all other admin tabs
4. THE Security tab SHALL be accessible via keyboard navigation and include proper ARIA attributes (`role="tab"`, `aria-selected`, `aria-controls`)

### Requirement 2: Security Summary Panel

**User Story:** As an admin, I want a high-level security summary visible at the top of the Security tab, so that I can quickly assess the current security state without reading individual events.

#### Acceptance Criteria

1. THE Security tab SHALL display a summary panel at the top showing: total events in buffer, count of info events, count of warning events, count of critical events, total active alerts (warning + critical), and number of flagged user IDs
2. THE summary panel SHALL fetch data from `GET /api/admin/security/summary` on tab mount
3. THE summary panel SHALL color-code severity counts using the design system colors: info in blue (`--primary`), warning in amber (`--warning`), critical in red (`--error`)
4. WHEN the summary API returns zero total events, THE summary panel SHALL display all counts as 0 with no error state
5. THE summary panel SHALL include a refresh button that re-fetches both the summary and the events list

### Requirement 3: Security Events Table

**User Story:** As an admin, I want to see a table of recent security events with key details, so that I can investigate suspicious activity and understand what the monitoring system has detected.

#### Acceptance Criteria

1. THE Security tab SHALL display a table of security events below the summary panel, showing: timestamp (formatted as relative time + absolute on hover), severity (color-coded badge), event type, user ID (if present), source IP (if present), and endpoint (if present)
2. THE events table SHALL fetch data from `GET /api/admin/security/events` with a default limit of 50
3. THE events table SHALL display events in reverse chronological order (newest first), matching the backend API's default sort
4. WHEN a user clicks on an event row, THE table SHALL expand an inline detail section showing the full `details` JSON object formatted as readable key-value pairs
5. WHEN the events API returns an empty array, THE table SHALL display a zero-state message: "No security events recorded" with an informational icon

### Requirement 4: Event Filtering

**User Story:** As an admin, I want to filter security events by severity, event type, and user ID, so that I can focus on specific categories of security activity.

#### Acceptance Criteria

1. THE Security tab SHALL provide a severity filter dropdown with options: All, Info, Warning, Critical
2. THE Security tab SHALL provide an event type filter dropdown populated with the distinct event types present in the current event set (e.g., `rapid_spending`, `race_condition_attempt`, `authorization_failure`, `validation_failure`, `automated_robot_creation`, `rate_limit_escalation`)
3. THE Security tab SHALL provide a user ID text input that filters events to a specific user
4. WHEN any filter is changed, THE Security tab SHALL re-fetch events from the backend API with the corresponding query parameters (`severity`, `eventType`, `userId`)
5. THE Security tab SHALL provide a "Clear Filters" button that resets all filters to their default (unfiltered) state and re-fetches

### Requirement 5: Flagged Users Display

**User Story:** As an admin, I want to see which users have been flagged by the security monitor, so that I can investigate potentially malicious accounts.

#### Acceptance Criteria

1. WHEN the summary response contains one or more `flaggedUserIds`, THE summary panel SHALL display them as a list of user ID badges
2. WHEN a flagged user ID badge is clicked, THE Security tab SHALL set the user ID filter to that user and re-fetch events, effectively showing all events for that user
3. WHEN there are no flagged users, THE flagged users section SHALL display "No flagged users" in muted text

### Requirement 6: Loading and Error States

**User Story:** As an admin, I want clear feedback when security data is loading or when an API call fails, so that I understand the current state of the dashboard.

#### Acceptance Criteria

1. WHILE the summary or events API calls are in progress, THE Security tab SHALL display a loading indicator with the text "Loading security data..."
2. WHEN an API call fails, THE Security tab SHALL display an error message with a "Retry" button that re-attempts the failed request
3. THE Security tab SHALL NOT crash or show a blank screen if the backend returns an unexpected response shape — it SHALL fall back to the zero-state display

### Requirement 7: Component Tests

**User Story:** As a developer, I want comprehensive tests for the Security tab, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE test suite SHALL verify the loading state renders correctly while API calls are pending
2. THE test suite SHALL verify the summary panel renders correct severity counts from mock data
3. THE test suite SHALL verify the events table renders event rows with correct severity badges, event types, and timestamps
4. THE test suite SHALL verify the zero-state renders when the API returns empty data
5. THE test suite SHALL verify that clicking a severity filter triggers a re-fetch with the correct query parameter
6. THE test suite SHALL verify that flagged user ID badges render and clicking one sets the user ID filter
