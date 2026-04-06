# Design Document: Admin Security Dashboard

## Overview

This design adds a "Security" tab to the existing admin portal, consuming the two backend API endpoints built in spec 11 (`GET /api/admin/security/events` and `GET /api/admin/security/summary`). The implementation follows the established admin tab decomposition pattern: a dedicated component in `components/admin/`, exported via the barrel file, and rendered by the `AdminPage` shell.

No backend changes are required. The APIs already support all the filtering and data shapes needed.

### Design Decisions

1. **Follow existing tab pattern exactly** — The admin portal uses a thin shell (`AdminPage.tsx`) that renders independent tab components. The Security tab follows this same pattern: own component, own state, own data fetching. No shared state or Zustand store needed since this data is only viewed on this one tab.
2. **No pagination, use limit parameter** — The backend circular buffer holds at most 500 events. The events endpoint already supports a `limit` parameter (max 200). We fetch 50 by default and let filters narrow results. This avoids pagination complexity for a small dataset.
3. **Client-side event type extraction** — Rather than a separate API call to get distinct event types, we extract unique `eventType` values from the fetched events to populate the event type filter dropdown. This is sufficient given the small dataset size.
4. **Inline detail expansion** — Clicking an event row expands a detail section below it showing the `details` JSON. This avoids a modal and keeps the admin in context, consistent with how other admin tabs handle detail views.
5. **Relative timestamps with absolute tooltip** — Event timestamps display as relative time (e.g., "3m ago", "1h ago") with the full ISO timestamp shown on hover via `title` attribute. This matches the quick-scan use case for security monitoring.

## Architecture

```
AdminPage.tsx (shell)
├── Tab Navigation (adds 'security' tab)
└── SecurityTab.tsx (new component)
    ├── Summary Panel
    │   ├── Severity count cards (info / warning / critical)
    │   ├── Total events + active alerts
    │   ├── Flagged users badges
    │   └── Refresh button
    ├── Filter Bar
    │   ├── Severity dropdown
    │   ├── Event type dropdown
    │   ├── User ID input
    │   └── Clear filters button
    └── Events Table
        ├── Event rows (severity badge, type, userId, sourceIp, endpoint, timestamp)
        └── Expandable detail section (JSON details)
```

The component makes two API calls on mount: one for the summary, one for the events list. Filter changes trigger a new events fetch only. The refresh button re-fetches both.

## Components and Interfaces

### 1. SecurityTab Component (`src/components/admin/SecurityTab.tsx`)

_Addresses: Requirements 1.2, 2, 3, 4, 5, 6_

The main tab component. Manages its own state for summary data, events, filters, loading, and error states.

```typescript
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';

/** Mirrors backend SecuritySeverity enum */
type SecuritySeverity = 'info' | 'warning' | 'critical';

/** Mirrors backend SecurityEvent interface */
interface SecurityEvent {
  severity: SecuritySeverity;
  eventType: string;
  userId?: number;
  sourceIp?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/** Response shape from GET /api/admin/security/summary */
interface SecuritySummary {
  totalEvents: number;
  bySeverity: Record<SecuritySeverity, number>;
  activeAlerts: number;
  flaggedUserIds: number[];
}

/** Response shape from GET /api/admin/security/events */
interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
}

interface Filters {
  severity: SecuritySeverity | '';
  eventType: string;
  userId: string;
}
```

State management:
- `summary: SecuritySummary | null` — fetched from `/api/admin/security/summary`
- `events: SecurityEvent[]` — fetched from `/api/admin/security/events`
- `filters: Filters` — current filter state, drives query params on re-fetch
- `loading: boolean` — true while either API call is in flight
- `error: string | null` — error message from failed API calls
- `expandedEventIndex: number | null` — which event row is expanded to show details

Data fetching:
- `fetchSummary()` — calls `GET /api/admin/security/summary`, sets `summary` state
- `fetchEvents()` — calls `GET /api/admin/security/events` with query params built from `filters`, sets `events` state
- `refresh()` — calls both `fetchSummary()` and `fetchEvents()`
- On mount: call `refresh()`
- On filter change: call `fetchEvents()` only

### 2. Summary Panel Section

_Addresses: Requirements 2.1–2.5, 5.1–5.3_

Renders inside `SecurityTab`. Displays severity count cards in a responsive grid.

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ Security Overview                          [↻ Refresh] │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  Total   │  ℹ Info  │ ⚠ Warn  │ 🔴 Crit  │ Active Alerts  │
│   142    │    98    │    38    │     6    │      44        │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│  Flagged Users: [ID 42] [ID 17] [ID 103]                   │
│  (click a user ID to filter events)                         │
└─────────────────────────────────────────────────────────────┘
```

Color mapping (from design system):
- Info count card: `text-primary` / `border-primary` (cyan-blue `#58a6ff`)
- Warning count card: `text-warning` / `border-warning` (amber `#d29922`)
- Critical count card: `text-error` / `border-error` (red `#f85149`)
- Active alerts: `text-error` if > 0, `text-secondary` if 0

Flagged user badges: rendered as clickable `<button>` elements styled as small badges. On click, sets `filters.userId` to the clicked ID and triggers `fetchEvents()`.

### 3. Filter Bar Section

_Addresses: Requirements 4.1–4.5_

A horizontal bar below the summary panel with three filter controls and a clear button.

```typescript
// Severity dropdown options
const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

// Event type options — derived from current events
const eventTypeOptions = useMemo(() => {
  const types = [...new Set(events.map(e => e.eventType))].sort();
  return [{ value: '', label: 'All Types' }, ...types.map(t => ({ value: t, label: t }))];
}, [events]);
```

The user ID input is a text field with debounced submission (on Enter or blur). Non-numeric input is ignored.

"Clear Filters" resets all three filters to empty strings and re-fetches.

### 4. Events Table Section

_Addresses: Requirements 3.1–3.5_

A table with columns: Timestamp, Severity, Event Type, User ID, Source IP, Endpoint.

```
┌────────────┬──────────┬─────────────────────┬─────────┬──────────────┬──────────────┐
│ Timestamp  │ Severity │ Event Type          │ User ID │ Source IP    │ Endpoint     │
├────────────┼──────────┼─────────────────────┼─────────┼──────────────┼──────────────┤
│ 3m ago     │ 🔴 CRIT  │ rapid_spending      │ 42      │ 192.168.1.5  │ /api/weapons │
│ 15m ago    │ ⚠ WARN   │ race_condition_att… │ 17      │ 10.0.0.3     │ /api/robots  │
│ 1h ago     │ ℹ INFO   │ validation_failure  │ —       │ 203.0.113.1  │ /api/auth    │
└────────────┴──────────┴─────────────────────┴─────────┴──────────────┴──────────────┘
```

Severity badges use the same color scheme as the summary cards, rendered as small colored pills:
- `info`: blue background (`bg-primary/20 text-primary`)
- `warning`: amber background (`bg-warning/20 text-warning`)
- `critical`: red background (`bg-error/20 text-error`)

Timestamp rendering:
- Display: relative time string (e.g., "3m ago", "1h ago", "2d ago")
- Hover (`title` attribute): full ISO timestamp
- Implementation: a simple `formatRelativeTime(isoString: string): string` utility function within the component

Row expansion:
- Clicking a row toggles `expandedEventIndex`
- Expanded section renders below the row as a `<tr>` spanning all columns
- Shows `details` as formatted key-value pairs (not raw JSON) in a `bg-surface` panel
- Keys in `text-secondary`, values in `text-primary`

Zero state:
- When `events.length === 0` and not loading: show centered message "No security events recorded" with an info icon

### 5. AdminPage Shell Changes (`src/pages/AdminPage.tsx`)

_Addresses: Requirements 1.1, 1.3, 1.4_

Minimal changes to the existing shell:

1. Add `'security'` to the `TabType` union and `VALID_TABS` array
2. Add `security: '🛡️ Security'` to `TAB_LABELS`
3. Import `SecurityTab` from the barrel export
4. Add the `case 'security'` render branch in the tab panel

### 6. Type Definitions (`src/components/admin/types.ts`)

_Addresses: Requirements 2, 3_

Add the shared types for the security tab to the existing admin types file:

```typescript
/** Security event from the admin security monitoring API */
export interface SecurityEvent {
  severity: 'info' | 'warning' | 'critical';
  eventType: string;
  userId?: number;
  sourceIp?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/** Response shape for GET /api/admin/security/summary */
export interface SecuritySummary {
  totalEvents: number;
  bySeverity: Record<'info' | 'warning' | 'critical', number>;
  activeAlerts: number;
  flaggedUserIds: number[];
}

/** Response shape for GET /api/admin/security/events */
export interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
}
```

### 7. Barrel Export Update (`src/components/admin/index.ts`)

_Addresses: Requirement 1.2_

Add `export { SecurityTab } from './SecurityTab';` to the barrel file.

## Documentation Impact

The following existing documents will need updating:

- `docs/prd_pages/PRD_ADMIN_PAGE.md` — Add section documenting the Security tab as the 9th tab, its features (summary panel, events table, filtering, flagged users), and its data sources (the two security API endpoints)
- `.kiro/steering/coding-standards.md` — No changes needed (the tab follows existing patterns)

## Data Models

No new database models. The component consumes the existing in-memory `SecurityEvent` and `SecuritySummary` structures via the admin API endpoints.

### API Contracts (existing, no changes)

**GET /api/admin/security/summary**
```json
{
  "totalEvents": 142,
  "bySeverity": { "info": 98, "warning": 38, "critical": 6 },
  "activeAlerts": 44,
  "flaggedUserIds": [42, 17, 103]
}
```

**GET /api/admin/security/events?severity=warning&eventType=rapid_spending&userId=42&limit=50**
```json
{
  "events": [
    {
      "severity": "warning",
      "eventType": "rapid_spending",
      "userId": 42,
      "sourceIp": "192.168.1.5",
      "endpoint": "/api/weapons/purchase",
      "details": { "totalAmount": 3500000, "windowMs": 300000 },
      "timestamp": "2026-04-03T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

## Error Handling

- API failures (network errors, 500s): display error message with "Retry" button, do not crash
- Unexpected response shapes: wrap API parsing in try-catch, fall back to zero-state
- Non-numeric user ID input: ignore, do not send to API
- The component never throws — all errors are caught and displayed inline

## Testing Strategy

### Unit Tests (`src/components/admin/__tests__/SecurityTab.test.tsx`)

Following the existing admin tab test pattern (mock `apiClient`, render component, assert DOM):

1. Loading state — mock pending promise, verify "Loading security data..." text
2. Summary panel rendering — mock summary response, verify severity counts and total events display
3. Events table rendering — mock events response, verify rows with correct severity badges and event types
4. Zero state — mock empty events response, verify "No security events recorded" message
5. Severity filter interaction — simulate dropdown change, verify `apiClient.get` called with `?severity=warning`
6. Flagged user badge click — mock summary with flagged users, simulate click, verify user ID filter set and re-fetch triggered
7. Error state — mock rejected promise, verify error message and "Retry" button render
8. Event row expansion — simulate row click, verify details section appears with key-value pairs
