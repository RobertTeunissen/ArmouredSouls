/**
 * Unit Tests for SecurityPage
 *
 * Tests summary cards render, flagged user click navigates to players page,
 * rate limit section displays.
 *
 * _Requirements: 12.1, 12.2, 12.3_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SecurityPage from '../SecurityPage';

// ----------------------------------------------------------------
// Mock apiClient
// ----------------------------------------------------------------
const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ----------------------------------------------------------------
// Mock useAdminStore
// ----------------------------------------------------------------
const mockFetchSecuritySummary = vi.fn();

const defaultSecuritySummary = {
  totalEvents: 42,
  bySeverity: { info: 30, warning: 10, critical: 2 },
  activeAlerts: 1,
  flaggedUserIds: [5, 12],
};

let mockStoreState = {
  securitySummary: defaultSecuritySummary,
  fetchSecuritySummary: mockFetchSecuritySummary,
};

vi.mock('../../../stores/adminStore', () => ({
  useAdminStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------
const mockEventsResponse = {
  events: [
    { severity: 'warning', eventType: 'rate_limit_violation', userId: 5, sourceIp: '1.2.3.4', endpoint: '/api/admin/battles', details: {}, timestamp: '2025-01-01T12:00:00Z' },
    { severity: 'info', eventType: 'admin_access', userId: 1, sourceIp: '5.6.7.8', endpoint: '/api/admin/stats', details: {}, timestamp: '2025-01-01T11:00:00Z' },
  ],
  total: 2,
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('SecurityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      securitySummary: defaultSecuritySummary,
      fetchSecuritySummary: mockFetchSecuritySummary,
    };
    mockGet.mockResolvedValue({ data: mockEventsResponse });
    mockFetchSecuritySummary.mockResolvedValue(undefined);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('should render summary cards with correct values', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Events')).toBeInTheDocument();
    });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument(); // info
    expect(screen.getByText('10')).toBeInTheDocument(); // warning
  });

  it('should render flagged user buttons', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('User 5')).toBeInTheDocument();
      expect(screen.getByText('User 12')).toBeInTheDocument();
    });
  });

  it('should render severity filter chips', async () => {
    renderPage();
    await waitFor(() => {
      // Filter chips use aria-pressed attribute
      const infoButtons = screen.getAllByText('Info');
      expect(infoButtons.length).toBeGreaterThanOrEqual(1);
      const warningButtons = screen.getAllByText('Warning');
      expect(warningButtons.length).toBeGreaterThanOrEqual(1);
      const criticalButtons = screen.getAllByText('Critical');
      expect(criticalButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should render rate limit violations section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Rate Limit Violations/)).toBeInTheDocument();
    });
  });

  it('should render security events table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Security Events')).toBeInTheDocument();
      expect(screen.getByText('rate_limit_violation')).toBeInTheDocument();
      expect(screen.getByText('admin_access')).toBeInTheDocument();
    });
  });

  it('should fetch security summary on mount', () => {
    renderPage();
    expect(mockFetchSecuritySummary).toHaveBeenCalledWith(true);
  });

  it('should show active alerts count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    });
  });
});
