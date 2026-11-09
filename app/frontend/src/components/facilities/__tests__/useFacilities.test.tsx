import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../../utils/ApiError';

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 42 }, refreshUser: mockRefreshUser }),
}));

const mockRefreshCurrency = vi.fn().mockResolvedValue(undefined);
const mockFetchStableData = vi.fn();
vi.mock('../../../stores', () => ({
  useStableStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ currency: 250000, refreshCurrency: mockRefreshCurrency, fetchStableData: mockFetchStableData }),
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));

import { useFacilities } from '../useFacilities';

const REPAIR_BAY = { type: 'repair_bay', name: 'Repair Bay', implemented: true };
const ROSTER = { type: 'roster_expansion', name: 'Roster Expansion', implemented: true };
const UNBUILT = { type: 'coming_soon', name: 'Coming Soon', implemented: false };

function wrapper(path = '/facilities') {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}

function serveFacilities(body: unknown): void {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/facilities') return Promise.resolve(body);
    if (url.endsWith('/roi/all-economic')) return Promise.resolve({ facilities: [{ facilityType: 'repair_bay' }] });
    if (url.endsWith('/recommendations')) return Promise.resolve({ recommendations: [{ facilityType: 'repair_bay' }] });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  serveFacilities({ facilities: [REPAIR_BAY, ROSTER, UNBUILT], userPrestige: 1200 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFacilities', () => {
  it('loads implemented facilities, the prestige and the stable data', async () => {
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.facilities.map((f) => f.type)).toEqual(['repair_bay', 'roster_expansion']);
    expect(result.current.userPrestige).toBe(1200);
    expect(result.current.currency).toBe(250000);
    expect(mockFetchStableData).toHaveBeenCalledTimes(1);
    expect(result.current.getCategoryFacilities(['repair_bay'])).toEqual([REPAIR_BAY]);
  });

  it('accepts the bare-array response shape', async () => {
    serveFacilities([REPAIR_BAY, UNBUILT]);
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.facilities).toEqual([REPAIR_BAY]);
    expect(result.current.userPrestige).toBe(0);
  });

  it('reports a failed load', async () => {
    mockGet.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load facilities');
  });

  it('loads the ROI and recommendations only on the investment tab', async () => {
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).not.toHaveBeenCalledWith('/api/analytics/facility/42/roi/all-economic');

    act(() => result.current.setActiveTab('investment-overview'));
    await waitFor(() => expect(result.current.recommendations).toHaveLength(1));
    expect(result.current.facilityROIs).toEqual([{ facilityType: 'repair_bay' }]);
    expect(result.current.advisorLoading).toBe(false);
  });

  it('keeps the tab usable when the advisor endpoints fail', async () => {
    mockGet.mockImplementation((url: string) =>
      url === '/api/facilities' ? Promise.resolve([REPAIR_BAY]) : Promise.reject(new Error('down')));
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setActiveTab('investment-overview'));
    await waitFor(() => expect(result.current.advisorLoading).toBe(false));
    expect(result.current.facilityROIs).toEqual([]);
    expect(result.current.recommendations).toEqual([]);
  });

  it('upgrades a facility and refreshes facilities, user and credits', async () => {
    mockPost.mockResolvedValue({});
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.handleUpgrade('repair_bay'));
    expect(mockPost).toHaveBeenCalledWith('/api/facilities/upgrade', { facilityType: 'repair_bay' });
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(mockRefreshCurrency).toHaveBeenCalled();
    expect(mockGet.mock.calls.filter(([url]) => url === '/api/facilities')).toHaveLength(2);
    expect(result.current.upgrading).toBeNull();
    expect(result.current.error).toBe('');
  });

  it('explains a prestige gate with the player\'s prestige', async () => {
    mockPost.mockRejectedValue(new ApiError('Forbidden', 'PRESTIGE_REQUIRED', 403, { current: 1200, message: 'Requires 5,000 prestige' }));
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.handleUpgrade('repair_bay'));
    expect(result.current.error).toBe('Requires 5,000 prestige. You have 1,200 prestige.');
  });

  it('shows other upgrade failures as they come', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('Insufficient credits', 'INSUFFICIENT_CREDITS', 400));
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.handleUpgrade('repair_bay'));
    expect(result.current.error).toBe('Insufficient credits');

    mockPost.mockRejectedValueOnce(new Error('socket'));
    await act(() => result.current.handleUpgrade('repair_bay'));
    expect(result.current.error).toBe('Upgrade failed');
  });

  it('collapses Advanced by default and toggles categories', async () => {
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.collapsedCategories.has('advanced')).toBe(true);

    act(() => result.current.toggleCategory('economy'));
    expect(result.current.collapsedCategories.has('economy')).toBe(true);
    act(() => result.current.toggleCategory('economy'));
    expect(result.current.collapsedCategories.has('economy')).toBe(false);
  });

  it('opens and scrolls to the facility named in the URL hash', async () => {
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper('/facilities#tuning_bay') });
    const element = document.createElement('div');
    element.scrollIntoView = vi.fn();
    result.current.facilityRefs.current.tuning_bay = element;

    await waitFor(() => expect(result.current.collapsedCategories.has('advanced')).toBe(false));
    await waitFor(() => expect(element.scrollIntoView).toHaveBeenCalled());
    expect(element.classList.contains('ring-2')).toBe(true);
  });

  it('names the economic facilities', () => {
    const { result } = renderHook(() => useFacilities(), { wrapper: wrapper() });
    expect(result.current.getFacilityDisplayName('streaming_studio')).toBe('Streaming Studio');
    expect(result.current.getFacilityDisplayName('unknown_type')).toBe('unknown_type');
  });
});
