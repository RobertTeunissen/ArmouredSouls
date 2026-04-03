import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SecurityTab } from '../SecurityTab';
import type { SecuritySummary, SecurityEventsResponse } from '../types';

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockSummary: SecuritySummary = {
  totalEvents: 142,
  bySeverity: { info: 98, warning: 38, critical: 6 },
  activeAlerts: 44,
  flaggedUserIds: [42, 17],
};

const mockEventsResponse: SecurityEventsResponse = {
  events: [
    {
      severity: 'critical',
      eventType: 'rapid_spending',
      userId: 42,
      sourceIp: '192.168.1.5',
      endpoint: '/api/weapons/purchase',
      details: { totalAmount: 3500000, windowMs: 300000 },
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    },
    {
      severity: 'warning',
      eventType: 'race_condition_attempt',
      userId: 17,
      sourceIp: '10.0.0.3',
      endpoint: '/api/robots',
      details: { conflictCount: 12, windowMs: 60000 },
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      severity: 'info',
      eventType: 'validation_failure',
      sourceIp: '203.0.113.1',
      endpoint: '/api/auth/login',
      details: { violationType: 'invalid_body', endpoint: '/api/auth/login', sourceIp: '203.0.113.1' },
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ],
  total: 3,
};

const mockEmptySummary: SecuritySummary = {
  totalEvents: 0,
  bySeverity: { info: 0, warning: 0, critical: 0 },
  activeAlerts: 0,
  flaggedUserIds: [],
};

const mockEmptyEvents: SecurityEventsResponse = { events: [], total: 0 };

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

function mockApiResponses(summary: SecuritySummary, events: SecurityEventsResponse) {
  mockedApiClient.get.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('security/summary')) {
      return Promise.resolve({ data: summary });
    }
    if (typeof url === 'string' && url.includes('security/events')) {
      return Promise.resolve({ data: events });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('SecurityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state while fetching', () => {
    mockedApiClient.get.mockReturnValue(new Promise(() => {}));

    render(<SecurityTab />);

    expect(screen.getByTestId('security-tab')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Loading security data...')).toBeInTheDocument();
  });

  it('should render summary panel with severity counts', async () => {
    mockApiResponses(mockSummary, mockEventsResponse);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument();
    });

    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('44')).toBeInTheDocument();
  });

  it('should render events table with correct rows', async () => {
    mockApiResponses(mockSummary, mockEventsResponse);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText('rapid_spending')).toBeInTheDocument();
    });

    expect(screen.getByText('race_condition_attempt')).toBeInTheDocument();
    expect(screen.getByText('validation_failure')).toBeInTheDocument();

    // Severity badges
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('WARNING')).toBeInTheDocument();
    expect(screen.getByText('INFO')).toBeInTheDocument();

    // Source IPs
    expect(screen.getByText('192.168.1.5')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.3')).toBeInTheDocument();
  });

  it('should render zero state when no events', async () => {
    mockApiResponses(mockEmptySummary, mockEmptyEvents);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByTestId('no-events-message')).toBeInTheDocument();
    });

    expect(screen.getByText('No security events recorded')).toBeInTheDocument();
    // All severity counts should be 0
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(5); // total, info, warning, critical, active alerts
  });

  it('should render flagged user badges and filter on click', async () => {
    mockApiResponses(mockSummary, mockEventsResponse);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText('User 42')).toBeInTheDocument();
    });

    expect(screen.getByText('User 17')).toBeInTheDocument();

    // Click a flagged user badge
    fireEvent.click(screen.getByText('User 42'));

    // Should have re-fetched with userId filter
    await waitFor(() => {
      const calls = mockedApiClient.get.mock.calls;
      const lastEventCall = calls.filter(c => typeof c[0] === 'string' && c[0].includes('security/events')).pop();
      expect(lastEventCall?.[0]).toContain('userId=42');
    });
  });

  it('should show "No flagged users" when none exist', async () => {
    mockApiResponses(mockEmptySummary, mockEmptyEvents);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText('No flagged users')).toBeInTheDocument();
    });
  });

  it('should filter events by severity when dropdown changes', async () => {
    mockApiResponses(mockSummary, mockEventsResponse);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText('rapid_spending')).toBeInTheDocument();
    });

    const severitySelect = screen.getByLabelText('Severity');
    fireEvent.change(severitySelect, { target: { value: 'warning' } });

    await waitFor(() => {
      const calls = mockedApiClient.get.mock.calls;
      const lastEventCall = calls.filter(c => typeof c[0] === 'string' && c[0].includes('security/events')).pop();
      expect(lastEventCall?.[0]).toContain('severity=warning');
    });
  });

  it('should render error state with retry button on API failure', async () => {
    mockedApiClient.get.mockRejectedValue(new Error('Network error'));

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should expand event details on row click', async () => {
    mockApiResponses(mockSummary, mockEventsResponse);

    render(<SecurityTab />);

    await waitFor(() => {
      expect(screen.getByText('rapid_spending')).toBeInTheDocument();
    });

    // Click the first event row
    fireEvent.click(screen.getByText('rapid_spending'));

    await waitFor(() => {
      expect(screen.getByTestId('event-details')).toBeInTheDocument();
    });

    // Should show detail keys
    expect(screen.getByText('totalAmount:')).toBeInTheDocument();
  });
});
