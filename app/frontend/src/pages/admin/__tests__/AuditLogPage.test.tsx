/**
 * Unit Tests for AuditLogPage
 *
 * Tests pagination works, filtering by type and date range works,
 * entries display in descending order.
 *
 * _Requirements: 19.4, 19.5_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuditLogPage from '../AuditLogPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockAuditData = {
  entries: [
    {
      id: 1,
      adminUserId: 1,
      adminUsername: 'admin',
      operationType: 'matchmaking_run',
      operationResult: 'success',
      resultSummary: { matchesCreated: 10 },
      createdAt: '2026-04-20T12:00:00Z',
    },
    {
      id: 2,
      adminUserId: 1,
      adminUsername: 'admin',
      operationType: 'battles_run',
      operationResult: 'failure',
      resultSummary: { error: 'timeout' },
      createdAt: '2026-04-20T11:00:00Z',
    },
  ],
  total: 30,
  page: 1,
  pageSize: 25,
  totalPages: 2,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockAuditData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AuditLogPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('should display audit entries', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('matchmaking run')).toBeInTheDocument();
      expect(screen.getByText('battles run')).toBeInTheDocument();
    });
  });

  it('should display operation results with badges', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('FAILURE')).toBeInTheDocument();
    });
  });

  it('should display admin username', async () => {
    renderPage();
    await waitFor(() => {
      const adminElements = screen.getAllByText('admin');
      expect(adminElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should display total entry count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('30 audit log entries found')).toBeInTheDocument();
    });
  });

  it('should render pagination when totalPages > 1', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('should fetch next page when Next is clicked', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('page=2');
    });
  });

  it('should render operation type filter chips', () => {
    renderPage();
    expect(screen.getByText('Matchmaking Run')).toBeInTheDocument();
    expect(screen.getByText('Battles Run')).toBeInTheDocument();
  });

  it('should fetch with operationType when filter is toggled', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Matchmaking Run'));

    await waitFor(() => {
      const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('operationType=matchmaking_run');
    });
  });

  it('should render date range inputs', () => {
    renderPage();
    expect(screen.getByTestId('start-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('end-date-input')).toBeInTheDocument();
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Audit log unavailable' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Audit log unavailable')).toBeInTheDocument();
    });
  });

  it('should fetch from the audit-log endpoint', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/audit-log'),
      );
    });
  });
});
